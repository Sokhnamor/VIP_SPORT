<?php

namespace App\Http\Resources;

use App\Models\User;
use App\Support\Dates;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nom' => $this->nom,
            'identifiant' => $this->identifiant,
            'role' => $this->role->value,
            'role_libelle' => $this->role->label(),
            'actif' => $this->actif,
            'doit_changer_mdp' => $this->doit_changer_mdp,
            'derniere_connexion' => Dates::iso($this->derniere_connexion),
        ];
    }
}
