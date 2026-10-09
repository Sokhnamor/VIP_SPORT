<?php

namespace App\Models;

use App\Models\Concerns\Immutable;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Journal d'audit : lecture seule. Écrit uniquement via App\Services\AuditLogger.
 *
 * @property int $id
 * @property int|null $user_id
 * @property string $action
 * @property string|null $entite
 * @property int|null $entite_id
 * @property array<string, mixed>|null $avant
 * @property array<string, mixed>|null $apres
 * @property string|null $ip
 * @property string|null $user_agent
 * @property CarbonImmutable $created_at
 * @property-read User|null $user
 */
class AuditLog extends Model
{
    use Immutable;

    const UPDATED_AT = null;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'avant' => 'array',
            'apres' => 'array',
            'created_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
