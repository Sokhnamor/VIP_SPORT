<?php

namespace App\Models;

use App\Enums\SubscriptionStatus;
use App\Support\Dates;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $member_id
 * @property int $plan_id
 * @property int $payment_id
 * @property CarbonImmutable $date_debut
 * @property CarbonImmutable $date_fin
 * @property CarbonImmutable $date_fin_initiale
 * @property SubscriptionStatus $statut
 * @property string|null $suspendu_motif
 * @property CarbonImmutable|null $suspendu_at
 * @property int|null $suspendu_par
 * @property CarbonImmutable|null $annule_at
 */
class Subscription extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'date_debut' => 'immutable_date',
            'date_fin' => 'immutable_date',
            'date_fin_initiale' => 'immutable_date',
            'suspendu_at' => 'immutable_datetime',
            'annule_at' => 'immutable_datetime',
            'statut' => SubscriptionStatus::class,
        ];
    }

    /** @return BelongsTo<Member, $this> */
    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    /** @return BelongsTo<Plan, $this> */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    /** @return BelongsTo<Payment, $this> */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    /** @return BelongsTo<User, $this> */
    public function suspendedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'suspendu_par');
    }

    /**
     * Statut affiché : les statuts stockés (suspendu, annule) priment,
     * sinon il est déduit des dates (expire, a_venir, actif).
     */
    public function statutEffectif(?string $today = null): SubscriptionStatus
    {
        $today ??= Dates::todayString();

        return match (true) {
            $this->statut === SubscriptionStatus::Annule => SubscriptionStatus::Annule,
            $this->statut === SubscriptionStatus::Suspendu => SubscriptionStatus::Suspendu,
            $this->date_fin->toDateString() < $today => SubscriptionStatus::Expire,
            $this->date_debut->toDateString() > $today => SubscriptionStatus::AVenir,
            default => SubscriptionStatus::Actif,
        };
    }

    /** Jours restants jusqu'à $fin, aujourd'hui inclus (0 si dépassé). */
    public static function daysUntil(string $fin, ?string $today = null): int
    {
        $start = CarbonImmutable::parse($today ?? Dates::todayString());
        $end = CarbonImmutable::parse($fin);

        return $end->lt($start) ? 0 : (int) $start->diffInDays($end) + 1;
    }
}
