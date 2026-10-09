<?php

namespace App\Models;

use App\Enums\ExpenseCategory;
use App\Enums\ExpenseStatus;
use App\Enums\PaymentMode;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property CarbonImmutable $date_depense
 * @property ExpenseCategory $categorie
 * @property int $montant
 * @property string $description
 * @property PaymentMode $mode
 * @property string|null $justificatif_path
 * @property ExpenseStatus $statut
 * @property int $user_id
 * @property int|null $cash_session_id
 * @property int|null $valide_par
 * @property CarbonImmutable|null $valide_at
 * @property string|null $motif_decision
 * @property-read User|null $validator
 * @property-read CashSession|null $cashSession
 */
class Expense extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['justificatif_path'];

    protected function casts(): array
    {
        return [
            'date_depense' => 'immutable_date',
            'montant' => 'integer',
            'categorie' => ExpenseCategory::class,
            'statut' => ExpenseStatus::class,
            'mode' => PaymentMode::class,
            'valide_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'valide_par');
    }

    /** @return BelongsTo<CashSession, $this> */
    public function cashSession(): BelongsTo
    {
        return $this->belongsTo(CashSession::class);
    }
}
