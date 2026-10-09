<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\MemberRequest;
use App\Http\Resources\AccessLogResource;
use App\Http\Resources\MemberResource;
use App\Http\Resources\PaymentResource;
use App\Http\Resources\SubscriptionResource;
use App\Models\Member;
use App\Models\Plan;
use App\Services\AuditLogger;
use App\Services\MemberService;
use App\Services\PdfService;
use App\Services\QrCodeService;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class MemberController extends Controller
{
    public function __construct(
        private readonly MemberService $members,
        private readonly AuditLogger $audit,
    ) {}

    public function index(Request $request)
    {
        Gate::authorize('viewAny', Member::class);

        $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'archives' => ['nullable', 'boolean'],
            'par_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $page = $this->members->search(
            $request->input('q'),
            $request->boolean('archives') && $request->user()->isAdmin(),
            (int) $request->input('par_page', 20),
        );

        return MemberResource::collection($page);
    }

    public function store(MemberRequest $request)
    {
        Gate::authorize('create', Member::class);

        $member = $this->members->create($request->memberData(), $request->file('photo'), $request->user());

        return (new MemberResource($member))->response()->setStatusCode(201);
    }

    /** Fiche membre : infos, abonnements, paiements, entrées récentes. */
    public function show(Request $request, Member $member): JsonResponse
    {
        Gate::authorize('view', $member);

        $this->audit->log('membre.consultation', $member);

        return response()->json([
            'data' => new MemberResource($member),
            'abonnements' => SubscriptionResource::collection(
                $member->subscriptions()->with('plan')->orderByDesc('date_debut')->limit(50)->get()
            ),
            'paiements' => PaymentResource::collection(
                $member->payments()->with(['plan', 'user', 'cancellation.user'])->orderByDesc('created_at')->limit(50)->get()
            ),
            'entrees' => AccessLogResource::collection(
                $member->accessLogs()->with('user')->orderByDesc('scanned_at')->limit(50)->get()
            ),
        ]);
    }

    public function update(MemberRequest $request, Member $member)
    {
        Gate::authorize('update', $member);

        $member = $this->members->update($member, $request->memberData(), $request->file('photo'), $request->user());

        return new MemberResource($member);
    }

    /** Photo servie par accès contrôlé : URL signée temporaire + session authentifiée. */
    public function photo(Member $member): Response
    {
        abort_unless($member->photo_path && Storage::disk(MemberService::DISK)->exists($member->photo_path), 404);

        return Storage::disk(MemberService::DISK)->response($member->photo_path, null, [
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    /** Période qu'aurait un nouvel abonnement (récapitulatif avant vente, calculé par le serveur). */
    public function quote(Request $request, Member $member, SubscriptionService $subscriptions): JsonResponse
    {
        Gate::authorize('view', $member);
        $data = $request->validate(['plan_id' => ['required', 'integer', 'exists:plans,id']]);
        $plan = Plan::findOrFail($data['plan_id']);

        [$debut, $fin] = $subscriptions->nextPeriod($member, $plan);

        return response()->json(['data' => [
            'montant_du' => $plan->prix_fcfa,
            'date_debut' => $debut->toDateString(),
            'date_fin' => $fin->toDateString(),
            'renouvellement_anticipe' => $member->coveredUntil() !== null,
        ]]);
    }

    public function qr(Member $member, QrCodeService $qr): Response
    {
        Gate::authorize('view', $member);
        abort_unless($member->qr_token !== null, 404, 'Ce membre n\'a pas encore de QR (aucun abonnement payé).');

        return response($qr->svg($member->qr_token), 200, ['Content-Type' => 'image/svg+xml', 'Cache-Control' => 'no-store']);
    }

    /** Carte de membre imprimable (format carte bancaire : nom, photo, QR). */
    public function card(Member $member, PdfService $pdf): Response
    {
        Gate::authorize('view', $member);
        abort_unless($member->qr_token !== null, 404, 'Ce membre n\'a pas encore de QR (aucun abonnement payé).');

        $this->audit->log('membre.carte_imprimee', $member);

        return $pdf->memberCard($member);
    }

    public function archive(Request $request, Member $member)
    {
        Gate::authorize('manage', $member);

        return new MemberResource($this->members->setArchived($member, true, $request->user()));
    }

    public function unarchive(Request $request, Member $member)
    {
        Gate::authorize('manage', $member);

        return new MemberResource($this->members->setArchived($member, false, $request->user()));
    }

    public function anonymize(Request $request, Member $member)
    {
        Gate::authorize('manage', $member);

        return new MemberResource($this->members->anonymize($member, $request->user()));
    }

    public function regenerateQr(Request $request, Member $member)
    {
        Gate::authorize('manage', $member);

        return new MemberResource($this->members->regenerateToken($member, $request->user()));
    }

    /** Export des données d'un membre (droit d'accès aux données personnelles). */
    public function export(Member $member): Response
    {
        Gate::authorize('manage', $member);

        $this->audit->log('membre.export', $member);

        $payload = [
            'membre' => (new MemberResource($member))->resolve(),
            'abonnements' => SubscriptionResource::collection($member->subscriptions()->with('plan')->get())->resolve(),
            'paiements' => PaymentResource::collection($member->payments()->with(['plan', 'user', 'cancellation'])->get())->resolve(),
            'entrees' => AccessLogResource::collection($member->accessLogs()->get())->resolve(),
        ];
        unset($payload['membre']['photo_url']);

        return response()->json($payload, 200, [
            'Content-Disposition' => 'attachment; filename="membre-'.$member->id.'.json"',
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }
}
