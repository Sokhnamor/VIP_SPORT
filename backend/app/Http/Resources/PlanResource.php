<?php

namespace App\Http\Resources;

use App\Models\Plan;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Plan */
class PlanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nom' => $this->nom,
            'duree_jours' => $this->duree_jours,
            'prix_fcfa' => $this->prix_fcfa,
            'est_seance' => $this->est_seance,
            'actif' => $this->actif,
        ];
    }
}
