<?php

namespace App\Services;

use App\Enums\ExpenseStatus;
use App\Enums\PaymentMode;
use App\Exceptions\BusinessRuleException;
use App\Models\Expense;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/**
 * Dépenses : saisies par un réceptionniste (en attente) ou un admin (validées directement).
 * Pas de suppression : un admin rejette ou annule avec un motif.
 */
class ExpenseService
{
    public const DISK = 'local';

    public function __construct(
        private readonly CashSessionService $cashSessions,
        private readonly AuditLogger $audit,
    ) {}

    public function create(array $data, ?UploadedFile $justificatif, User $user): Expense
    {
        return DB::transaction(function () use ($data, $justificatif, $user) {
            $sessionId = null;
            if (! empty($data['payee_depuis_caisse'])) {
                if (($data['mode'] ?? null) !== PaymentMode::Especes->value) {
                    throw new BusinessRuleException(
                        'Seule une dépense en espèces peut être payée depuis la caisse.',
                        'DEPENSE_CAISSE_NON_ESPECES',
                    );
                }
                // La sortie d'espèces sera déduite du montant attendu à la clôture.
                $sessionId = $this->cashSessions->requireOpenSession($user)->id;
            }

            $isAdmin = $user->isAdmin();

            $expense = Expense::create([
                'date_depense' => $data['date_depense'],
                'categorie' => $data['categorie'],
                'montant' => (int) $data['montant'],
                'description' => $data['description'],
                'mode' => $data['mode'],
                'justificatif_path' => $justificatif?->store('expenses', self::DISK),
                'statut' => $isAdmin ? ExpenseStatus::Validee : ExpenseStatus::EnAttente,
                'user_id' => $user->id,
                'cash_session_id' => $sessionId,
                'valide_par' => $isAdmin ? $user->id : null,
                'valide_at' => $isAdmin ? now() : null,
            ]);

            $this->audit->log('depense.creation', $expense, null, $expense->only([
                'date_depense', 'categorie', 'montant', 'description', 'mode', 'statut', 'cash_session_id',
            ]), $user);

            return $expense;
        });
    }

    public function decide(Expense $expense, ExpenseStatus $decision, User $admin, ?string $motif): Expense
    {
        $allowed = match ($decision) {
            ExpenseStatus::Validee, ExpenseStatus::Rejetee => $expense->statut === ExpenseStatus::EnAttente,
            ExpenseStatus::Annulee => $expense->statut !== ExpenseStatus::Annulee,
            default => false,
        };

        if (! $allowed) {
            throw new BusinessRuleException(
                "Action impossible : la dépense est « {$expense->statut->label()} ».",
                'DEPENSE_STATUT_INVALIDE',
            );
        }

        $expense->fill([
            'statut' => $decision,
            'valide_par' => $admin->id,
            'valide_at' => now(),
            'motif_decision' => $motif,
        ]);
        [$avant, $apres] = $this->audit->diff($expense);
        $expense->save();

        $this->audit->log('depense.'.$decision->value, $expense, $avant, $apres, $admin);

        return $expense;
    }
}
