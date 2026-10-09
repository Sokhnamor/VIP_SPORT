<?php

namespace App\Models;

use Database\Factories\PlanFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $nom
 * @property int $duree_jours
 * @property int $prix_fcfa
 * @property bool $est_seance
 * @property bool $actif
 */
#[Fillable(['nom', 'duree_jours', 'prix_fcfa', 'est_seance', 'actif'])]
class Plan extends Model
{
    /** @use HasFactory<PlanFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'duree_jours' => 'integer',
            'prix_fcfa' => 'integer',
            'est_seance' => 'boolean',
            'actif' => 'boolean',
        ];
    }
}
