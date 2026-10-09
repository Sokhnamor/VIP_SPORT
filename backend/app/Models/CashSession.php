<?php

namespace App\Models;

use App\Enums\CashSessionStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use LogicException;

/**
 * Session de caisse. Une fois clôturée, elle est verrouillée : seul le commentaire admin
 * peut être ajouté (voir CashSessionService).
 *
 * @property int $id
 * @property int $user_id
 * @property CarbonImmutable $ouverte_at
 * @property int $fond_initial
 * @property CarbonImmutable|null $fermee_at
 * @property int|null $especes_attendues
 * @property int|null $especes_comptees
 * @property int|null $ecart
 * @property string|null $motif_ecart
 * @property CashSessionStatus $statut
 * @property int|null $verrou_ouverte
 * @property string|null $commentaire_admin
 * @property int|null $commente_par
 * @property CarbonImmutable|null $commente_at
 * @property-read User|null $commentator
 */
class CashSession extends Model
{
    protected $guarded = ['id'];

    /** Seuls champs modifiables après clôture. */
    private const EDITABLE_WHEN_CLOSED = ['commentaire_admin', 'commente_par', 'commente_at', 'updated_at'];

    protected static function booted(): void
    {
        static::updating(function (CashSession $session) {
            $wasClosed = $session->getOriginal('statut') === CashSessionStatus::Cloturee;
            $forbidden = array_diff(array_keys($session->getDirty()), self::EDITABLE_WHEN_CLOSED);

            if ($wasClosed && $forbidden !== []) {
                throw new LogicException('Session de caisse clôturée : verrouillée.');
            }
        });

        static::deleting(fn () => throw new LogicException('Une session de caisse ne se supprime pas.'));
    }

    protected function casts(): array
    {
        return [
            'ouverte_at' => 'immutable_datetime',
            'fermee_at' => 'immutable_datetime',
            'commente_at' => 'immutable_datetime',
            'fond_initial' => 'integer',
            'especes_attendues' => 'integer',
            'especes_comptees' => 'integer',
            'ecart' => 'integer',
            'statut' => CashSessionStatus::class,
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function commentator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'commente_par');
    }

    /** @return HasMany<Payment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /** @return HasMany<Expense, $this> */
    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function isOpen(): bool
    {
        return $this->statut === CashSessionStatus::Ouverte;
    }
}
