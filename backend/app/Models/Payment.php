<?php

namespace App\Models;

use App\Enums\PaymentMode;
use App\Models\Concerns\Immutable;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Paiement : jamais modifié ni supprimé (trait Immutable + triggers MySQL).
 * Seul PaymentService crée des paiements, dans une transaction avec l'abonnement ou le ticket.
 *
 * @property int $id
 * @property string $numero_recu
 * @property int|null $member_id
 * @property int $plan_id
 * @property int $montant_du
 * @property int $reduction
 * @property string|null $motif_reduction
 * @property int|null $reduction_autorisee_par
 * @property int $montant_encaisse
 * @property PaymentMode $mode
 * @property string|null $reference_transaction
 * @property int $user_id
 * @property int $cash_session_id
 * @property CarbonImmutable $created_at
 * @property-read Member|null $member
 * @property-read User|null $reductionApprover
 * @property-read PaymentCancellation|null $cancellation
 * @property-read Subscription|null $subscription
 * @property-read Ticket|null $ticket
 */
class Payment extends Model
{
    use Immutable;

    const UPDATED_AT = null;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'montant_du' => 'integer',
            'reduction' => 'integer',
            'montant_encaisse' => 'integer',
            'mode' => PaymentMode::class,
            'created_at' => 'immutable_datetime',
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

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function reductionApprover(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reduction_autorisee_par');
    }

    /** @return BelongsTo<CashSession, $this> */
    public function cashSession(): BelongsTo
    {
        return $this->belongsTo(CashSession::class);
    }

    /** @return HasOne<PaymentCancellation, $this> */
    public function cancellation(): HasOne
    {
        return $this->hasOne(PaymentCancellation::class);
    }

    /** @return HasOne<Subscription, $this> */
    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class);
    }

    /** @return HasOne<Ticket, $this> */
    public function ticket(): HasOne
    {
        return $this->hasOne(Ticket::class);
    }

    /** Paiements non annulés. */
    public function scopeValid(Builder $query): Builder
    {
        return $query->whereDoesntHave('cancellation');
    }
}
