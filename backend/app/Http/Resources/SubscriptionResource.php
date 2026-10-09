<?php

namespace App\Http\Resources;

use App\Models\Subscription;
use App\Support\Dates;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Subscription */
class SubscriptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $statut = $this->statutEffectif();

        return [
            'id' => $this->id,
            'member_id' => $this->member_id,
            'plan' => $this->whenLoaded('plan', fn () => new PlanResource($this->plan)),
            'plan_id' => $this->plan_id,
            'payment_id' => $this->payment_id,
            'date_debut' => $this->date_debut->toDateString(),
            'date_fin' => $this->date_fin->toDateString(),
            'date_fin_initiale' => $this->date_fin_initiale->toDateString(),
            'statut' => $statut->value,
            'statut_libelle' => $statut->label(),
            'suspendu_motif' => $this->suspendu_motif,
            'suspendu_at' => Dates::iso($this->suspendu_at),
            'annule_at' => Dates::iso($this->annule_at),
            'created_at' => Dates::iso($this->created_at),
        ];
    }
}
