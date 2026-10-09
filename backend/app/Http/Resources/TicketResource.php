<?php

namespace App\Http\Resources;

use App\Models\Ticket;
use App\Support\Dates;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Ticket */
class TicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $statut = $this->statutEffectif();

        return [
            'id' => $this->id,
            'numero' => $this->numero,
            'payment_id' => $this->payment_id,
            'member_id' => $this->member_id,
            'valable_le' => $this->valable_le->toDateString(),
            'statut' => $statut->value,
            'statut_libelle' => $statut->label(),
            'utilise_at' => Dates::iso($this->utilise_at),
            'qr_url' => "/api/v1/tickets/{$this->id}/qr",
            'pdf_url' => "/api/v1/tickets/{$this->id}/pdf",
        ];
    }
}
