<?php

namespace App\Services;

use App\Enums\CashSessionStatus;
use App\Enums\ExpenseStatus;
use App\Enums\PaymentMode;
use App\Exceptions\BusinessRuleException;
use App\Models\CashSession;
use App\Models\User;
use App\Support\Money;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CashSessionService
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function open(User $user, int $fondInitial): CashSession
    {
        if ($user->openCashSession()->exists()) {
            throw new BusinessRuleException(
                'Vous avez déjà une session de caisse ouverte. Clôturez-la avant d\'en ouvrir une autre.',
                'CAISSE_DEJA_OUVERTE',
            );
        }

        try {
            $session = DB::transaction(function () use ($user, $fondInitial) {
                $session = CashSession::create([
                    'user_id' => $user->id,
                    'ouverte_at' => now(),
                    'fond_initial' => $fondInitial,
                    'statut' => CashSessionStatus::Ouverte,
                    // Index unique : une seule session ouverte par utilisateur, garanti en base.
                    'verrou_ouverte' => $user->id,
                ]);

                $this->audit->log('caisse.ouverture', $session, null, [
                    'fond_initial' => $fondInitial,
                ], $user);

                return $session;
            });
        } catch (QueryException) {
            // Deux ouvertures simultanées : l'index unique a rejeté la seconde.
            throw new BusinessRuleException('Vous avez déjà une session de caisse ouverte.', 'CAISSE_DEJA_OUVERTE');
        }

        return $session;
    }

    /**
     * Session ouverte de l'encaisseur, verrouillée pour la durée de la transaction en cours.
     * Aucune vente n'est possible sans elle (règle d'or : tout franc est rattaché à une caisse).
     */
    public function requireOpenSession(User $user): CashSession
    {
        $session = CashSession::query()
            ->where('verrou_ouverte', $user->id)
            ->lockForUpdate()
            ->first();

        if (! $session) {
            throw new BusinessRuleException(
                'Aucune session de caisse ouverte. Ouvrez votre caisse avant d\'encaisser.',
                'CAISSE_NON_OUVERTE',
            );
        }

        return $session;
    }

    /**
     * Totaux de la session. Espèces attendues = fond + espèces encaissées (non annulées)
     * − dépenses payées en espèces depuis cette caisse (en attente ou validées).
     *
     * @return array<string, int>
     */
    public function summary(CashSession $session): array
    {
        $byMode = $session->payments()
            ->whereDoesntHave('cancellation')
            ->selectRaw('mode, COUNT(*) as nb, COALESCE(SUM(montant_encaisse), 0) as total')
            ->groupBy('mode')
            ->get()
            ->keyBy(fn ($row) => $row->mode->value);

        $total = fn (PaymentMode $mode) => (int) ($byMode[$mode->value]->total ?? 0);

        $depensesEspeces = (int) $session->expenses()
            ->where('mode', PaymentMode::Especes->value)
            ->whereIn('statut', [ExpenseStatus::EnAttente->value, ExpenseStatus::Validee->value])
            ->sum('montant');

        $annulations = (int) $session->payments()->whereHas('cancellation')->count();

        return [
            'fond_initial' => $session->fond_initial,
            'especes' => $total(PaymentMode::Especes),
            'wave' => $total(PaymentMode::Wave),
            'orange_money' => $total(PaymentMode::OrangeMoney),
            'autre' => $total(PaymentMode::Autre),
            'nombre_paiements' => (int) $byMode->sum('nb'),
            'nombre_annulations' => $annulations,
            'depenses_especes' => $depensesEspeces,
            'especes_attendues' => $session->fond_initial + $total(PaymentMode::Especes) - $depensesEspeces,
        ];
    }

    public function close(CashSession $session, User $user, int $especesComptees, ?string $motif): CashSession
    {
        return DB::transaction(function () use ($session, $user, $especesComptees, $motif) {
            /** @var CashSession $session */
            $session = CashSession::query()->lockForUpdate()->findOrFail($session->id);

            if ($session->user_id !== $user->id) {
                throw new BusinessRuleException('Seul l\'employé qui a ouvert la caisse peut la clôturer.', 'CAISSE_AUTRE_EMPLOYE', 403);
            }
            if (! $session->isOpen()) {
                throw new BusinessRuleException('Cette session de caisse est déjà clôturée.', 'CAISSE_CLOTUREE');
            }

            $attendues = $this->summary($session)['especes_attendues'];
            $ecart = $especesComptees - $attendues;
            $motif = $motif !== null ? trim($motif) : null;

            if ($ecart !== 0 && ($motif === null || $motif === '')) {
                throw ValidationException::withMessages([
                    'motif_ecart' => sprintf(
                        'Écart de %s : un motif est obligatoire.',
                        ($ecart > 0 ? '+' : '−').Money::fcfa(abs($ecart)),
                    ),
                ]);
            }

            $session->forceFill([
                'fermee_at' => now(),
                'especes_attendues' => $attendues,
                'especes_comptees' => $especesComptees,
                'ecart' => $ecart,
                'motif_ecart' => $ecart !== 0 ? $motif : ($motif ?: null),
                'statut' => CashSessionStatus::Cloturee,
                'verrou_ouverte' => null,
            ])->save();

            $this->audit->log('caisse.cloture', $session, null, [
                'especes_attendues' => $attendues,
                'especes_comptees' => $especesComptees,
                'ecart' => $ecart,
                'motif_ecart' => $session->motif_ecart,
            ], $user);

            return $session;
        });
    }

    /** L'admin commente une clôture ; il ne peut jamais en modifier les montants. */
    public function comment(CashSession $session, User $admin, string $commentaire): CashSession
    {
        $before = ['commentaire_admin' => $session->commentaire_admin];

        $session->forceFill([
            'commentaire_admin' => $commentaire,
            'commente_par' => $admin->id,
            'commente_at' => now(),
        ])->save();

        $this->audit->log('caisse.commentaire', $session, $before, ['commentaire_admin' => $commentaire], $admin);

        return $session;
    }
}
