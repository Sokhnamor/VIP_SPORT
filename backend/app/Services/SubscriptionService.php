<?php

namespace App\Services;

use App\Enums\SubscriptionStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\Dates;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use LogicException;

class SubscriptionService
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * Période d'un nouvel abonnement :
     * - début = aujourd'hui, ou lendemain de la dernière date de fin active (renouvellement anticipé) ;
     * - fin = début + durée − 1 jour.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public function nextPeriod(Member $member, Plan $plan): array
    {
        $today = Dates::today();
        $coveredUntil = $member->coveredUntil();

        $debut = $coveredUntil
            ? CarbonImmutable::parse($coveredUntil, Dates::timezone())->addDay()->startOfDay()
            : $today;

        if ($debut->lt($today)) {
            $debut = $today;
        }

        return [$debut, $debut->addDays($plan->duree_jours - 1)];
    }

    /**
     * Crée l'abonnement payé. Appelé UNIQUEMENT par PaymentService, dans la transaction
     * du paiement : un abonnement n'existe jamais sans paiement.
     */
    public function createForPayment(Member $member, Plan $plan, Payment $payment): Subscription
    {
        if (DB::transactionLevel() === 0 || ! $payment->exists) {
            throw new LogicException('Un abonnement ne se crée que dans la transaction de son paiement enregistré.');
        }

        [$debut, $fin] = $this->nextPeriod($member, $plan);

        return Subscription::create([
            'member_id' => $member->id,
            'plan_id' => $plan->id,
            'payment_id' => $payment->id,
            'date_debut' => $debut->toDateString(),
            'date_fin' => $fin->toDateString(),
            'date_fin_initiale' => $fin->toDateString(),
            'statut' => SubscriptionStatus::Actif,
        ]);
    }

    public function suspend(Subscription $subscription, User $admin, string $motif): Subscription
    {
        $effectif = $subscription->statutEffectif();
        if (! in_array($effectif, [SubscriptionStatus::Actif, SubscriptionStatus::AVenir], true)) {
            throw new BusinessRuleException(
                'Seul un abonnement actif ou à venir peut être suspendu (statut actuel : '.$effectif->label().').',
                'ABONNEMENT_NON_SUSPENDABLE',
            );
        }

        $subscription->fill([
            'statut' => SubscriptionStatus::Suspendu,
            'suspendu_motif' => $motif,
            'suspendu_at' => now(),
            'suspendu_par' => $admin->id,
        ]);
        [$avant, $apres] = $this->audit->diff($subscription);
        $subscription->save();

        $this->audit->log('abonnement.suspension', $subscription, $avant, $apres, $admin);

        return $subscription;
    }

    /**
     * Lève la suspension. L'admin peut saisir une nouvelle date de fin (prolongation
     * de la durée suspendue) ; l'ancienne reste visible dans l'audit et date_fin_initiale.
     */
    public function resume(Subscription $subscription, User $admin, ?string $nouvelleDateFin, ?string $motif): Subscription
    {
        if ($subscription->statut !== SubscriptionStatus::Suspendu) {
            throw new BusinessRuleException('Cet abonnement n\'est pas suspendu.', 'ABONNEMENT_NON_SUSPENDU');
        }

        return DB::transaction(function () use ($subscription, $admin, $nouvelleDateFin, $motif) {
            $dateFin = $nouvelleDateFin ?? $subscription->date_fin->toDateString();

            if ($dateFin < $subscription->date_debut->toDateString()) {
                throw new BusinessRuleException('La date de fin ne peut pas précéder la date de début.', 'DATE_FIN_INVALIDE');
            }

            // Règle : un seul abonnement actif à un instant donné.
            $chevauchement = Subscription::query()
                ->where('member_id', $subscription->member_id)
                ->where('id', '!=', $subscription->id)
                ->where('statut', SubscriptionStatus::Actif->value)
                ->whereDate('date_debut', '<=', $dateFin)
                ->whereDate('date_fin', '>=', $subscription->date_debut->toDateString())
                ->exists();

            if ($chevauchement) {
                throw new BusinessRuleException(
                    'Impossible de réactiver : la période chevauche un autre abonnement actif du membre.',
                    'CHEVAUCHEMENT_ABONNEMENT',
                );
            }

            $subscription->fill([
                'statut' => SubscriptionStatus::Actif,
                'date_fin' => $dateFin,
            ]);
            [$avant, $apres] = $this->audit->diff($subscription);
            $subscription->save();

            $this->audit->log('abonnement.reactivation', $subscription, $avant, $apres + ['motif' => $motif], $admin);

            return $subscription;
        });
    }

    /** Annulation suite à l'annulation du paiement (appelé par PaymentService). */
    public function cancelForPayment(Subscription $subscription): void
    {
        $subscription->forceFill([
            'statut' => SubscriptionStatus::Annule,
            'annule_at' => now(),
        ])->save();
    }
}
