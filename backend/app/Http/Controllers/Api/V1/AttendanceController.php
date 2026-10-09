<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ScanResult;
use App\Http\Controllers\Controller;
use App\Http\Resources\AccessLogResource;
use App\Http\Resources\MemberResource;
use App\Models\AccessLog;
use App\Models\Presence;
use App\Support\Dates;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AttendanceController extends Controller
{
    /** Présences du jour (liste en direct à la réception). */
    public function today(): JsonResponse
    {
        [$start, $end] = Dates::dayBoundsUtc(Dates::todayString());

        $presences = Presence::query()
            ->with(['member', 'ticket'])
            ->whereBetween('entree_at', [$start, $end])
            ->orderByDesc('entree_at')
            ->get();

        return response()->json([
            'data' => $presences->map(fn (Presence $p) => [
                'id' => $p->id,
                'membre' => $p->member ? [
                    'id' => $p->member->id,
                    'nom_complet' => $p->member->nom_complet,
                    'photo_url' => MemberResource::photoUrl($p->member),
                ] : null,
                'ticket' => $p->ticket?->numero,
                'entree_at' => Dates::iso($p->entree_at),
                'sortie_at' => Dates::iso($p->sortie_at),
                'cloture_auto' => $p->cloture_auto,
            ]),
            'total' => $presences->count(),
            'presents' => $presences->whereNull('sortie_at')->count(),
        ]);
    }

    /** Journal des accès (admin), filtrable. */
    public function logs(Request $request)
    {
        $request->validate([
            'du' => ['nullable', 'date_format:Y-m-d'],
            'au' => ['nullable', 'date_format:Y-m-d'],
            'resultat' => ['nullable', Rule::enum(ScanResult::class)],
            'manuel' => ['nullable', 'boolean'],
            'member_id' => ['nullable', 'integer'],
        ]);

        $query = AccessLog::query()
            ->with(['member', 'ticket', 'user'])
            ->when($request->filled('resultat'), fn ($q) => $q->where('resultat', $request->input('resultat')))
            ->when($request->has('manuel'), fn ($q) => $q->where('manuel', $request->boolean('manuel')))
            ->when($request->filled('member_id'), fn ($q) => $q->where('member_id', $request->integer('member_id')))
            ->orderByDesc('scanned_at');

        if ($request->filled('du') || $request->filled('au')) {
            $query->whereBetween('scanned_at', Dates::rangeBoundsUtc(
                $request->input('du', '2000-01-01'),
                $request->input('au', Dates::todayString()),
            ));
        }

        return AccessLogResource::collection($query->paginate(50));
    }
}
