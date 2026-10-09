<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\PlanRequest;
use App\Http\Resources\PlanResource;
use App\Models\Plan;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class PlanController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request)
    {
        Gate::authorize('viewAny', Plan::class);

        $plans = Plan::query()
            ->when(! $request->boolean('tous'), fn ($q) => $q->where('actif', true))
            ->orderBy('est_seance', 'desc')
            ->orderBy('duree_jours')
            ->get();

        return PlanResource::collection($plans);
    }

    public function store(PlanRequest $request)
    {
        Gate::authorize('create', Plan::class);

        $plan = Plan::create($request->validated());
        $this->audit->log('formule.creation', $plan, null, $plan->only(['nom', 'duree_jours', 'prix_fcfa', 'est_seance', 'actif']));

        return (new PlanResource($plan))->response()->setStatusCode(201);
    }

    /** Modifier un tarif n'altère pas l'historique : le prix est figé dans chaque paiement. */
    public function update(PlanRequest $request, Plan $plan)
    {
        Gate::authorize('update', $plan);

        $plan->fill($request->validated());
        [$avant, $apres] = $this->audit->diff($plan);
        $plan->save();

        if ($apres !== []) {
            $this->audit->log('formule.modification', $plan, $avant, $apres);
        }

        return new PlanResource($plan);
    }
}
