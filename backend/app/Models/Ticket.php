<?php

namespace App\Models;

use App\Enums\TicketStatus;
use App\Support\Dates;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property string $numero
 * @property int $payment_id
 * @property int|null $member_id
 * @property string $qr_token
 * @property CarbonImmutable $valable_le
 * @property TicketStatus $statut
 * @property CarbonImmutable|null $utilise_at
 * @property-read Member|null $member
 */
class Ticket extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['qr_token'];

    protected function casts(): array
    {
        return [
            'valable_le' => 'immutable_date',
            'utilise_at' => 'immutable_datetime',
            'statut' => TicketStatus::class,
        ];
    }

    /** @return BelongsTo<Payment, $this> */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    /** @return BelongsTo<Member, $this> */
    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    /** « expire » est calculé : ticket encore valide mais d'un jour passé. */
    public function statutEffectif(?string $today = null): TicketStatus
    {
        $today ??= Dates::todayString();

        if ($this->statut === TicketStatus::Valide && $this->valable_le->toDateString() < $today) {
            return TicketStatus::Expire;
        }

        return $this->statut;
    }
}
