<?php

namespace App\Http\Resources;

use App\Models\AuditLog;
use App\Support\Dates;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin AuditLog */
class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'action' => $this->action,
            'utilisateur' => $this->whenLoaded('user', fn () => $this->user?->nom),
            'user_id' => $this->user_id,
            'entite' => $this->entite,
            'entite_id' => $this->entite_id,
            'avant' => $this->avant,
            'apres' => $this->apres,
            'ip' => $this->ip,
            'created_at' => Dates::iso($this->created_at),
        ];
    }
}
