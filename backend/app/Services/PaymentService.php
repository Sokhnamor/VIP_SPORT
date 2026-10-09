<?php

namespace App\Services;

use App\Enums\PaymentMode;
use App\Enums\Role;
use App\Enums\TicketStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\CashSession;
use App\Models\Member;
use App\Models\Payment;
use App\Models\PaymentCancellation;
use App\Models\Plan;
use App\Models\Ticket;
use App\Models\User;
use App\Support\Dates;
use App\Support\Money;
use App\Support\Token;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Règle d'or : aucune entrée sans paiement enregistré.
 *
 * Toute vente passe par ce service. Paiement + abonnement (ou ticket) + QR sont créés dans
 * UNE transaction : si une étape échoue, rien n'est enregistré (ni paiement, ni abonnement,
 * ni QR, ni numéro de reçu consommé).
 *
 * Données de vente attendues ($data) :
 *  - mode (especes|wave|orange_money|autre), montant_encaisse (int)
 *  - reference_transaction (obligatoire pour wave / orange_money)
 *  - reduction (int, 0 par défaut), motif_reduction
 *  - autorisation.identifiant / autorisation.mot_de_passe : identifiants d'un admin saisis sur
 *    le poste quand un réceptionniste applique une réduction.
 */
class PaymentService
{
    public function __construct(
        private readonly CashSessionService $cashSessions,
        private readonly SubscriptionService $subscriptions,
        private readonly ReceiptNumberGenerator $receipts,
        private readonly AuditLogger $audit,
    ) {}

    /** Vente ou renouvellement d'abonnement. */
    public function sellSubscription(User $cashier, Member $member, Plan $plan, array $data): Payment
    {
        if ($plan->est_seance) {
            throw new BusinessRuleException('La séance unique se vend comme ticket, pas comme abonnement.', 'FORMULE_SEANCE');
        }
        $this->assertPlanSellable($plan);

        if ($member->isArchived()) {
            throw new BusinessRuleException('Ce membre est archivé : réactivez-le avant de lui vendre un abonnement.', 'MEMBRE_ARCHIVE');
        }

        $approver = $this->resolveReductionApprover($cashier, $data);

        return DB::transaction(function () use ($cashier, $member, $plan, $data, $approver) {
            // Verrou sur le membre : deux ventes simultanées pour le même membre sont sérialisées
            // (sinon deux abonnements pourraient démarrer le même jour).
            $member = Member::query()->lockForUpdate()->findOrFail($member->id);
            $session = $this->cashSessions->requireOpenSession($cashier);

            $payment = $this->createPayment($cashier, $session, $plan, $member, $data, $approver);
            $subscription = $this->subscriptions->createForPayment($member, $plan, $payment);

            $nouveauQr = false;
            if (! $member->qr_token) {
                $member->forceFill(['qr_token' => Token::member(), 'qr_genere_at' => now()])->save();
                $nouveauQr = true;
            }

            $this->audit->log('paiement.creation', $payment, null, $this->auditPayload($payment) + [
                'abonnement_id' => $subscription->id,
                'periode' => $subscription->date_debut->toDateString().' → '.$subscription->date_fin->toDateString(),
                'qr_genere' => $nouveauQr,
            ], $cashier);

            return $payment;
        });
    }

    /** Vente d'une séance unique : ticket à usage unique valable aujourd'hui. */
    public function sellTicket(User $cashier, Plan $plan, array $data, ?Member $member = null): Payment
    {
        if (! $plan->est_seance) {
            throw new BusinessRuleException('Cette formule n\'est pas une séance unique.', 'FORMULE_NON_SEANCE');
        }
        $this->assertPlanSellable($plan);

        $approver = $this->resolveReductionApprover($cashier, $data);

        return DB::transaction(function () use ($cashier, $plan, $data, $member, $approver) {
            $session = $this->cashSessions->requireOpenSession($cashier);
            $payment = $this->createPayment($cashier, $session, $plan, $member, $data, $approver);

            $ticket = Ticket::create([
                'numero' => $this->uniqueTicketNumber(),
                'payment_id' => $payment->id,
                'member_id' => $member?->id,
                'qr_token' => Token::ticket(),
                'valable_le' => Dates::todayString(),
                'statut' => TicketStatus::Valide,
            ]);

            $this->audit->log('paiement.creation', $payment, null, $this->auditPayload($payment) + [
                'ticket' => $ticket->numero,
            ], $cashier);

            return $payment;
        });
    }

    /**
     * Annulation (admin uniquement) : le paiement reste intact, une annulation liée est créée,
     * l'abonnement passe à « annule » et le QR / ticket est immédiatement refusé au scan.
     */
    public function cancel(Payment $payment, User $admin, string $motif): PaymentCancellation
    {
        return DB::transaction(function () use ($payment, $admin, $motif) {
            $payment = Payment::query()->lockForUpdate()->findOrFail($payment->id);

            if ($payment->cancellation()->exists()) {
                throw new BusinessRuleException('Ce paiement est déjà annulé.', 'PAIEMENT_DEJA_ANNULE');
            }

            $cancellation = PaymentCancellation::create([
                'payment_id' => $payment->id,
                'user_id' => $admin->id,
                'motif' => $motif,
                'created_at' => now(),
            ]);

            if ($subscription = $payment->subscription) {
                $this->subscriptions->cancelForPayment($subscription);
            }

            if ($ticket = $payment->ticket) {
                $ticket->forceFill(['statut' => TicketStatus::Annule])->save();
            }

            $this->audit->log('paiement.annulation', $payment, $this->auditPayload($payment), [
                'motif' => $motif,
                'abonnement_annule' => $subscription?->id,
                'ticket_annule' => $ticket?->numero,
            ], $admin);

            return $cancellation;
        });
    }

    private function createPayment(
        User $cashier,
        CashSession $session,
        Plan $plan,
        ?Member $member,
        array $data,
        ?User $approver,
    ): Payment {
        $mode = PaymentMode::from($data['mode']);

        // Montant dû : toujours le prix de la formule lu en base, jamais une valeur du client.
        $montantDu = $plan->prix_fcfa;
        $reduction = (int) ($data['reduction'] ?? 0);

        if ($reduction > $montantDu) {
            throw ValidationException::withMessages(['reduction' => 'La réduction ne peut pas dépasser le montant dû.']);
        }

        $attendu = $montantDu - $reduction;
        if ((int) $data['montant_encaisse'] !== $attendu) {
            throw ValidationException::withMessages([
                'montant_encaisse' => 'Le montant encaissé doit être exactement '.Money::fcfa($attendu).'.',
            ]);
        }

        $reference = isset($data['reference_transaction']) ? trim((string) $data['reference_transaction']) : null;
        if ($mode->requiresReference() && ! $reference) {
            throw ValidationException::withMessages([
                'reference_transaction' => 'La référence de transaction est obligatoire pour '.$mode->label().'.',
            ]);
        }
        if ($mode === PaymentMode::Especes) {
            $reference = null;
        }
        if ($reference && Payment::query()->where('reference_transaction', $reference)->exists()) {
            throw ValidationException::withMessages([
                'reference_transaction' => 'Cette référence de transaction a déjà été utilisée.',
            ]);
        }

        return Payment::create([
            'numero_recu' => $this->receipts->next(),
            'member_id' => $member?->id,
            'plan_id' => $plan->id,
            'montant_du' => $montantDu,
            'reduction' => $reduction,
            'motif_reduction' => $reduction > 0 ? trim((string) $data['motif_reduction']) : null,
            'reduction_autorisee_par' => $reduction > 0 ? $approver?->id : null,
            'montant_encaisse' => $attendu,
            'mode' => $mode,
            'reference_transaction' => $reference ?: null,
            'user_id' => $cashier->id,
            'cash_session_id' => $session->id,
            'created_at' => now(),
        ]);
    }

    /**
     * Une réduction n'est possible que par un admin : soit l'encaisseur est admin, soit un admin
     * actif saisit ses identifiants sur le poste. Sinon : 403.
     */
    private function resolveReductionApprover(User $cashier, array $data): ?User
    {
        $reduction = (int) ($data['reduction'] ?? 0);
        if ($reduction <= 0) {
            return null;
        }

        if (blank($data['motif_reduction'] ?? null)) {
            throw ValidationException::withMessages(['motif_reduction' => 'Le motif de la réduction est obligatoire.']);
        }

        if ($cashier->isAdmin()) {
            return $cashier;
        }

        $identifiant = $data['autorisation']['identifiant'] ?? null;
        $motDePasse = $data['autorisation']['mot_de_passe'] ?? null;

        $admin = $identifiant
            ? User::query()->where('identifiant', $identifiant)->where('role', Role::Admin->value)->where('actif', true)->first()
            : null;

        if (! $admin || ! $motDePasse || ! Hash::check($motDePasse, $admin->password)) {
            $this->audit->log('reduction.refusee', 'Payment', null, [
                'reduction' => $reduction,
                'identifiant_saisi' => $identifiant,
            ], $cashier);

            throw new AuthorizationException('Réduction refusée : l\'autorisation d\'un administrateur est requise.');
        }

        return $admin;
    }

    private function assertPlanSellable(Plan $plan): void
    {
        if (! $plan->actif) {
            throw new BusinessRuleException('Cette formule n\'est plus en vente.', 'FORMULE_INACTIVE');
        }
    }

    private function uniqueTicketNumber(): string
    {
        do {
            $numero = Token::ticketNumber();
        } while (Ticket::query()->where('numero', $numero)->exists());

        return $numero;
    }

    /** @return array<string, mixed> */
    private function auditPayload(Payment $payment): array
    {
        return [
            'numero_recu' => $payment->numero_recu,
            'member_id' => $payment->member_id,
            'plan_id' => $payment->plan_id,
            'montant_du' => $payment->montant_du,
            'reduction' => $payment->reduction,
            'motif_reduction' => $payment->motif_reduction,
            'reduction_autorisee_par' => $payment->reduction_autorisee_par,
            'montant_encaisse' => $payment->montant_encaisse,
            'mode' => $payment->mode->value,
            'reference_transaction' => $payment->reference_transaction,
            'cash_session_id' => $payment->cash_session_id,
        ];
    }
}
