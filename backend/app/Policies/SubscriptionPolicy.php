<?php

namespace App\Policies;

use App\Models\Subscription;
use App\Models\User;

class SubscriptionPolicy
{
    /** Suspendre / réactiver / prolonger : admin uniquement. */
    public function suspend(User $user, Subscription $subscription): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, Subscription $subscription): bool
    {
        return false;
    }
}
