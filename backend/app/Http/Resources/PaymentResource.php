<?php

namespace App\Http\Resources;

use App\Models\Payment;
use App\Support\Dates;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Payment */
class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'numero_recu' => $this->numero_recu,
            'member' => $this->whenLoaded('member', fn () => $this->member ? [
                'id' => $this->member->id,
                'nom_complet' => $this->member->nom_complet,
                'telephone' => $this->member->telephone,
            ] : null),
            'member_id' => $this->member_id,
            'plan' => $this->whenLoaded('plan', fn () => ['id' => $this->plan->id, 'nom' => $this->plan->nom, 'est_seance' => $this->plan->est_seance]),
            'montant_du' => $this->montant_du,
            'reduction' => $this->reduction,
            'motif_reduction' => $this->motif_reduction,
            'reduction_autorisee_par' => $this->whenLoaded('reductionApprover', fn () => $this->reductionApprover?->nom),
            'montant_encaisse' => $this->montant_encaisse,
            'mode' => $this->mode->value,
            'mode_libelle' => $this->mode->label(),
            'reference_transaction' => $this->reference_transaction,
            'encaisseur' => $this->whenLoaded('user', fn () => ['id' => $this->user->id, 'nom' => $this->user->nom]),
            'cash_session_id' => $this->cash_session_id,
            'created_at' => Dates::iso($this->created_at),
            'annule' => $this->relationLoaded('cancellation') ? $this->cancellation !== null : null,
            'annulation' => $this->whenLoaded('cancellation', fn () => $this->cancellation ? [
                'motif' => $this->cancellation->motif,
                'par' => $this->cancellation->user?->nom,
                'created_at' => Dates::iso($this->cancellation->created_at),
            ] : null),
            'abonnement' => $this->whenLoaded('subscription', fn () => $this->subscription ? new SubscriptionResource($this->subscription) : null),
            'ticket' => $this->whenLoaded('ticket', fn () => $this->ticket ? new TicketResource($this->ticket) : null),
        ];
    }
}
