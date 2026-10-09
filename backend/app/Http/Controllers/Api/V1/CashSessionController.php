<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\PaymentMode;
use App\Http\Controllers\Controller;
use App\Http\Requests\CloseCashSessionRequest;
use App\Http\Resources\CashSessionResource;
use App\Http\Resources\ExpenseResource;
use App\Http\Resources\PaymentResource;
use App\Models\CashSession;
use App\Services\CashSessionService;
use App\Services\PdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class CashSessionController extends Controller
{
    public function __construct(private readonly CashSessionService $sessions) {}

    /** Historique : l'admin voit toutes les sessions et leurs écarts, le réceptionniste les siennes. */
    public function index(Request $request)
    {
        Gate::authorize('viewAny', CashSession::class);
        $user = $request->user();

        $sessions = CashSession::query()
            ->with(['user', 'commentator'])
            ->when(! $user->isAdmin(), fn ($q) => $q->where('user_id', $user->id))
            ->when($user->isAdmin() && $request->filled('user_id'), fn ($q) => $q->where('user_id', $request->integer('user_id')))
            ->when($request->boolean('avec_ecart'), fn ($q) => $q->whereNotNull('ecart')->where('ecart', '!=', 0))
            ->orderByDesc('ouverte_at')
            ->paginate(25);

        return CashSessionResource::collection($sessions);
    }

    /** Session ouverte de l'utilisateur connecté, avec ses totaux en cours. */
    public function current(Request $request): JsonResponse
    {
        Gate::authorize('open', CashSession::class);
        $session = $request->user()->openCashSession()->with('user')->first();

        return response()->json([
            'data' => $session ? (new CashSessionResource($session))->withSummary($this->sessions->summary($session)) : null,
        ]);
    }

    public function store(Request $request)
    {
        Gate::authorize('open', CashSession::class);
        $data = $request->validate(['fond_initial' => ['required', 'integer', 'min:0', 'max:100000000']]);

        $session = $this->sessions->open($request->user(), $data['fond_initial']);

        return (new CashSessionResource($session->load('user')))
            ->withSummary($this->sessions->summary($session))
            ->response()
            ->setStatusCode(201);
    }

    public function show(CashSession $cashSession): JsonResponse
    {
        Gate::authorize('view', $cashSession);
        $cashSession->load(['user', 'commentator']);

        $payments = $cashSession->payments()->with(['member', 'plan', 'user', 'cancellation.user'])->orderBy('created_at')->get();

        return response()->json([
            'data' => (new CashSessionResource($cashSession))->withSummary($this->sessions->summary($cashSession)),
            'paiements' => PaymentResource::collection($payments),
            'depenses' => ExpenseResource::collection($cashSession->expenses()->with('user')->get()),
        ]);
    }

    public function close(CloseCashSessionRequest $request, CashSession $cashSession)
    {
        Gate::authorize('close', $cashSession);

        $session = $this->sessions->close(
            $cashSession,
            $request->user(),
            $request->integer('especes_comptees'),
            $request->input('motif_ecart'),
        );

        return (new CashSessionResource($session->load('user')))->withSummary($this->sessions->summary($session));
    }

    public function comment(Request $request, CashSession $cashSession)
    {
        Gate::authorize('comment', $cashSession);
        $data = $request->validate(['commentaire' => ['required', 'string', 'max:2000']]);

        $session = $this->sessions->comment($cashSession, $request->user(), $data['commentaire']);

        return new CashSessionResource($session->load(['user', 'commentator']));
    }

    /** Liste imprimable des paiements Wave / Orange Money pour rapprochement avec le relevé opérateur. */
    public function mobileMoney(Request $request, CashSession $cashSession, PdfService $pdf): Response|JsonResponse
    {
        Gate::authorize('view', $cashSession);

        $payments = $cashSession->payments()
            ->with(['member', 'plan', 'cancellation'])
            ->whereIn('mode', [PaymentMode::Wave->value, PaymentMode::OrangeMoney->value])
            ->orderBy('mode')
            ->orderBy('created_at')
            ->get();

        if ($request->query('format') === 'pdf') {
            return $pdf->mobileMoney($cashSession->load('user'), $payments);
        }

        return response()->json(['data' => PaymentResource::collection($payments)]);
    }
}
