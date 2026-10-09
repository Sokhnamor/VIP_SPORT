<?php

namespace App\Http\Resources;

use App\Models\Expense;
use App\Support\Dates;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Expense */
class ExpenseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'date_depense' => $this->date_depense->toDateString(),
            'categorie' => $this->categorie->value,
            'categorie_libelle' => $this->categorie->label(),
            'montant' => $this->montant,
            'description' => $this->description,
            'mode' => $this->mode->value,
            'mode_libelle' => $this->mode->label(),
            'a_justificatif' => $this->justificatif_path !== null,
            'justificatif_url' => $this->justificatif_path ? "/api/v1/expenses/{$this->id}/justificatif" : null,
            'statut' => $this->statut->value,
            'statut_libelle' => $this->statut->label(),
            'auteur' => $this->whenLoaded('user', fn () => $this->user->nom),
            'payee_depuis_caisse' => $this->cash_session_id !== null,
            'cash_session_id' => $this->cash_session_id,
            'decide_par' => $this->whenLoaded('validator', fn () => $this->validator?->nom),
            'decide_at' => Dates::iso($this->valide_at),
            'motif_decision' => $this->motif_decision,
            'created_at' => Dates::iso($this->created_at),
        ];
    }
}
