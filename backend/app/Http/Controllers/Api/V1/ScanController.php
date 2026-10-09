<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\AccessType;
use App\Enums\ScanResult;
use App\Http\Controllers\Controller;
use App\Http\Resources\MemberResource;
use App\Models\Member;
use App\Services\AccessControlService;
use App\Services\ReportService;
use App\Services\ScanOutcome;
use App\Support\Dates;
use App\Support\Settings;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;

class ScanController extends Controller
{
    public function __construct(private readonly AccessControlService $access) {}

    /**
     * Le poste envoie le contenu brut du QR ; le serveur décide. Les jetons inconnus sont
     * limités plus strictement (essai massif de jetons), au-delà : HTTP 429.
     */
    public function scan(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:200'],
            'type' => ['nullable', Rule::enum(AccessType::class)],
        ]);

        $key = 'scan-unknown:'.$request->user()->id.'|'.$request->ip();
        $maxUnknown = (int) config('gym.scan_unknown_per_minute');

        if (RateLimiter::tooManyAttempts($key, $maxUnknown)) {
            throw new ThrottleRequestsException('Trop de QR inconnus.', null, ['Retry-After' => RateLimiter::availableIn($key)]);
        }

        $outcome = $this->access->scan(
            $data['code'],
            AccessType::tryFrom($data['type'] ?? '') ?? AccessType::Entree,
            $request->user(),
            $request->ip(),
        );

        if ($outcome->result === ScanResult::RefuseInconnu) {
            RateLimiter::hit($key, 60);
        }

        return response()->json(['data' => $this->present($outcome)]);
    }

    /** Entrée manuelle exceptionnelle (réception) : motif obligatoire, visible dans un rapport dédié. */
    public function manual(Request $request): JsonResponse
    {
        $data = $request->validate([
            'member_id' => ['required', 'integer', 'exists:members,id'],
            'motif' => ['required', 'string', 'min:3', 'max:500'],
        ]);

        $outcome = $this->access->manualEntry(
            Member::findOrFail($data['member_id']),
            $data['motif'],
            $request->user(),
            $request->ip(),
        );

        return response()->json(['data' => $this->present($outcome)]);
    }

    /** Compteur affiché sur le poste de scan + options utiles (sortie activée ou non). */
    public function stats(ReportService $reports): JsonResponse
    {
        $today = Dates::todayString();

        return response()->json(['data' => [
            'entrees_jour' => $reports->entriesCount($today, $today),
            'mode_sortie' => (bool) Settings::get('mode_sortie'),
            'nom_salle' => Settings::get('nom_salle'),
            'heure_serveur' => Dates::iso(Dates::now()),
        ]]);
    }

    private function present(ScanOutcome $outcome): array
    {
        $member = $outcome->member;

        return [
            'resultat' => $outcome->result->value,
            'couleur' => $outcome->result->color(),
            'accepte' => $outcome->result->isAccepted(),
            'message' => $outcome->message,
            'type' => $outcome->type->value,
            // Données minimales pour la vérification visuelle (anti-partage) : nom et photo.
            'membre' => $member ? [
                'id' => $member->id,
                'nom_complet' => $member->nom_complet,
                'photo_url' => MemberResource::photoUrl($member),
            ] : null,
            'ticket' => $outcome->ticket ? ['numero' => $outcome->ticket->numero] : null,
            'date_fin' => $outcome->dateFin,
            'jours_restants' => $outcome->joursRestants,
            'scanned_at' => Dates::iso($outcome->log?->scanned_at),
        ];
    }
}
