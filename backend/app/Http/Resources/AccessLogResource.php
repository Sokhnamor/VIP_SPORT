<?php

namespace App\Http\Resources;

use App\Models\AccessLog;
use App\Support\Dates;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin AccessLog */
class AccessLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'resultat' => $this->resultat->value,
            'couleur' => $this->resultat->color(),
            'type' => $this->type->value,
            'manuel' => $this->manuel,
            'motif_manuel' => $this->motif_manuel,
            'member' => $this->whenLoaded('member', fn () => $this->member ? ['id' => $this->member->id, 'nom_complet' => $this->member->nom_complet] : null),
            'ticket' => $this->whenLoaded('ticket', fn () => $this->ticket?->numero),
            'operateur' => $this->whenLoaded('user', fn () => $this->user->nom),
            'scanned_at' => Dates::iso($this->scanned_at),
            'ip' => $this->ip,
        ];
    }
}
