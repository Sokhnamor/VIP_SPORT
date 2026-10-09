<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int|null $member_id
 * @property int|null $ticket_id
 * @property int $access_log_id
 * @property CarbonImmutable $entree_at
 * @property CarbonImmutable|null $sortie_at
 * @property bool $cloture_auto
 * @property-read Member|null $member
 * @property-read Ticket|null $ticket
 */
class Presence extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'entree_at' => 'immutable_datetime',
            'sortie_at' => 'immutable_datetime',
            'cloture_auto' => 'boolean',
        ];
    }

    /** @return BelongsTo<Member, $this> */
    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    /** @return BelongsTo<Ticket, $this> */
    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    /** @return BelongsTo<AccessLog, $this> */
    public function accessLog(): BelongsTo
    {
        return $this->belongsTo(AccessLog::class);
    }
}
