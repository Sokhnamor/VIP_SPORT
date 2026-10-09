<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaleRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Services\PaymentService;
use Illuminate\Support\Facades\Gate;

/** Ventes : abonnement (avec renouvellement anticipé) et séance unique. */
class SaleController extends Controller
{
    public function __construct(private readonly PaymentService $payments) {}

    public function subscription(SaleRequest $request)
    {
        Gate::authorize('create', Payment::class);

        $payment = $this->payments->sellSubscription(
            $request->user(),
            Member::findOrFail($request->integer('member_id')),
            Plan::findOrFail($request->integer('plan_id')),
            $request->validated(),
        );

        return $this->created($payment);
    }

    public function ticket(SaleRequest $request)
    {
        Gate::authorize('create', Payment::class);

        $payment = $this->payments->sellTicket(
            $request->user(),
            Plan::findOrFail($request->integer('plan_id')),
            $request->validated(),
            $request->filled('member_id') ? Member::findOrFail($request->integer('member_id')) : null,
        );

        return $this->created($payment);
    }

    private function created(Payment $payment)
    {
        $payment->load(['member', 'plan', 'user', 'reductionApprover', 'subscription', 'ticket', 'cancellation']);

        return (new PaymentResource($payment))->response()->setStatusCode(201);
    }
}
