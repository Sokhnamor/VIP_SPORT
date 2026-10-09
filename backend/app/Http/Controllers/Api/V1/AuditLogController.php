<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Support\Dates;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Journal d'audit : lecture seule, filtrable (admin). */
class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'action' => ['nullable', 'string', 'max:60'],
            'user_id' => ['nullable', 'integer'],
            'entite' => ['nullable', 'string', 'max:60'],
            'entite_id' => ['nullable', 'integer'],
            'du' => ['nullable', 'date_format:Y-m-d'],
            'au' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $query = AuditLog::query()
            ->with('user')
            ->when($request->filled('action'), fn ($q) => $q->where('action', 'like', $request->input('action').'%'))
            ->when($request->filled('user_id'), fn ($q) => $q->where('user_id', $request->integer('user_id')))
            ->when($request->filled('entite'), fn ($q) => $q->where('entite', $request->input('entite')))
            ->when($request->filled('entite_id'), fn ($q) => $q->where('entite_id', $request->integer('entite_id')))
            ->orderByDesc('id');

        if ($request->filled('du') || $request->filled('au')) {
            $query->whereBetween('created_at', Dates::rangeBoundsUtc(
                $request->input('du', '2000-01-01'),
                $request->input('au', Dates::todayString()),
            ));
        }

        return AuditLogResource::collection($query->paginate(50));
    }

    /** Liste des actions existantes, pour le filtre de l'écran. */
    public function actions(): JsonResponse
    {
        return response()->json(['data' => AuditLog::query()->distinct()->orderBy('action')->pluck('action')]);
    }
}
