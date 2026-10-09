<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\PaymentMode;
use App\Http\Controllers\Controller;
use App\Http\Requests\ReasonRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Services\AuditLogger;
use App\Services\PaymentService;
use App\Services\PdfService;
use App\Support\Dates;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class PaymentController extends Controller
{
    public function __construct(private readonly PaymentService $payments) {}

    /** Liste des reçus : l'admin voit tout, le réceptionniste ses propres encaissements. */
    public function index(Request $request)
    {
        Gate::authorize('viewAny', Payment::class);

        $request->validate([
            'du' => ['nullable', 'date_format:Y-m-d'],
            'au' => ['nullable', 'date_format:Y-m-d'],
            'mode' => ['nullable', Rule::enum(PaymentMode::class)],
            'q' => ['nullable', 'string', 'max:50'],
            'user_id' => ['nullable', 'integer'],
        ]);

        $user = $request->user();
        $query = Payment::query()
            ->with(['member', 'plan', 'user', 'cancellation.user'])
            ->when(! $user->isAdmin(), fn ($q) => $q->where('user_id', $user->id))
            ->when($user->isAdmin() && $request->filled('user_id'), fn ($q) => $q->where('user_id', $request->integer('user_id')))
            ->when($request->filled('mode'), fn ($q) => $q->where('mode', $request->input('mode')))
            ->when($request->filled('q'), function ($q) use ($request) {
                $term = trim($request->input('q'));
                $q->where(fn ($w) => $w->where('numero_recu', 'like', "%{$term}%")->orWhere('reference_transaction', 'like', "%{$term}%"));
            })
            ->orderByDesc('created_at');

        if ($request->filled('du') || $request->filled('au')) {
            [$start, $end] = Dates::rangeBoundsUtc($request->input('du', '2000-01-01'), $request->input('au', Dates::todayString()));
            $query->whereBetween('created_at', [$start, $end]);
        }

        return PaymentResource::collection($query->paginate(25));
    }

    public function show(Payment $payment)
    {
        Gate::authorize('view', $payment);

        $payment->load(['member', 'plan', 'user', 'reductionApprover', 'subscription', 'ticket', 'cancellation.user']);

        return new PaymentResource($payment);
    }

    /** Reçu PDF : format A5 ou ticket 80 mm. */
    public function receipt(Request $request, Payment $payment, PdfService $pdf, AuditLogger $audit): Response
    {
        Gate::authorize('view', $payment);
        $format = $request->query('format') === '80mm' ? '80mm' : 'a5';

        $audit->log('paiement.recu_imprime', $payment, null, ['format' => $format]);

        return $pdf->receipt($payment, $format);
    }

    public function cancel(ReasonRequest $request, Payment $payment)
    {
        Gate::authorize('cancel', $payment);

        $this->payments->cancel($payment, $request->user(), $request->input('motif'));

        return $this->show($payment->fresh());
    }

    /** Immuabilité : toute tentative de modification ou suppression est refusée (et c'est voulu). */
    public function forbidden(Payment $payment): never
    {
        Gate::authorize('delete', $payment);

        abort(403);
    }
}
