<?php

namespace App\Models;

use App\Enums\AccessType;
use App\Enums\ScanResult;
use App\Models\Concerns\Immutable;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Journal des scans : chaque tentative, acceptée ou refusée. Append-only.
 *
 * @property int $id
 * @property int|null $member_id
 * @property int|null $ticket_id
 * @property int|null $subscription_id
 * @property string|null $token_scanne
 * @property ScanResult $resultat
 * @property AccessType $type
 * @property bool $manuel
 * @property string|null $motif_manuel
 * @property int $user_id
 * @property CarbonImmutable $scanned_at
 * @property string|null $ip
 * @property-read Member|null $member
 * @property-read Ticket|null $ticket
 */
class AccessLog extends Model
{
    use Immutable;

    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'resultat' => ScanResult::class,
            'type' => AccessType::class,
            'manuel' => 'boolean',
            'scanned_at' => 'immutable_datetime',
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

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
