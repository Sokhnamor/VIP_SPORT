<?php

namespace App\Http\Resources;

use App\Models\Member;
use App\Support\Dates;
use App\Support\Phone;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\URL;

/** @mixin Member */
class MemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $current = $this->currentSubscription();

        return [
            'id' => $this->id,
            'nom' => $this->nom,
            'prenom' => $this->prenom,
            'nom_complet' => $this->nom_complet,
            'telephone' => $this->telephone,
            'telephone_affiche' => Phone::display($this->telephone),
            'email' => $this->email,
            'date_naissance' => $this->date_naissance?->toDateString(),
            'sexe' => $this->sexe,
            'contact_urgence' => $this->contact_urgence,
            'notes' => $this->notes,
            'date_inscription' => $this->date_inscription->toDateString(),
            'statut' => $this->statut->value,
            'anonymise' => $this->anonymise_at !== null,
            'photo_url' => self::photoUrl($this->resource),
            'a_un_qr' => $this->qr_token !== null,
            'abonnement_en_cours' => $current ? new SubscriptionResource($current) : null,
            'couvert_jusqu_au' => $this->coveredUntil(),
            'created_at' => Dates::iso($this->created_at),
        ];
    }

    /**
     * URL signée et temporaire de la photo : la photo n'est jamais publique, et l'URL ne
     * peut pas être devinée (utile au poste de scan qui n'a pas accès aux fiches).
     */
    public static function photoUrl($member): ?string
    {
        if (! $member->photo_path) {
            return null;
        }

        return URL::temporarySignedRoute(
            'members.photo',
            now()->addMinutes(60),
            ['member' => $member->id, 'v' => substr(md5($member->photo_path), 0, 8)],
            absolute: false,
        );
    }
}
