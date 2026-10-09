<?php

namespace App\Http\Resources;

use App\Models\CashSession;
use App\Support\Dates;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CashSession */
class CashSessionResource extends JsonResource
{
    /** @var array<string, int>|null */
    public ?array $summary = null;

    public function withSummary(array $summary): static
    {
        $this->summary = $summary;

        return $this;
    }

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employe' => $this->whenLoaded('user', fn () => ['id' => $this->user->id, 'nom' => $this->user->nom]),
            'user_id' => $this->user_id,
            'ouverte_at' => Dates::iso($this->ouverte_at),
            'fermee_at' => Dates::iso($this->fermee_at),
            'fond_initial' => $this->fond_initial,
            'especes_attendues' => $this->especes_attendues,
            'especes_comptees' => $this->especes_comptees,
            'ecart' => $this->ecart,
            'motif_ecart' => $this->motif_ecart,
            'statut' => $this->statut->value,
            'commentaire_admin' => $this->commentaire_admin,
            'commente_par' => $this->whenLoaded('commentator', fn () => $this->commentator?->nom),
            'commente_at' => Dates::iso($this->commente_at),
            'oubli_cloture' => $this->isOpen() && $this->ouverte_at->lt(Dates::today()),
            'totaux' => $this->summary,
        ];
    }
}
