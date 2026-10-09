<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReasonRequest;
use App\Http\Requests\ResumeSubscriptionRequest;
use App\Http\Resources\SubscriptionResource;
use App\Models\Subscription;
use App\Services\SubscriptionService;
use Illuminate\Support\Facades\Gate;

class SubscriptionController extends Controller
{
    public function __construct(private readonly SubscriptionService $subscriptions) {}

    public function suspend(ReasonRequest $request, Subscription $subscription)
    {
        Gate::authorize('suspend', $subscription);

        $subscription = $this->subscriptions->suspend($subscription, $request->user(), $request->input('motif'));

        return new SubscriptionResource($subscription->load('plan'));
    }

    public function resume(ResumeSubscriptionRequest $request, Subscription $subscription)
    {
        Gate::authorize('suspend', $subscription);

        $subscription = $this->subscriptions->resume(
            $subscription,
            $request->user(),
            $request->input('date_fin'),
            $request->input('motif'),
        );

        return new SubscriptionResource($subscription->load('plan'));
    }
}
