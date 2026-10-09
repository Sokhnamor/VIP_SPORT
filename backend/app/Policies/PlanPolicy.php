<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Plan;
use App\Models\User;

class PlanPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Receptionniste);
    }

    /** Seul l'admin fixe les tarifs. */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    public function update(User $user, Plan $plan): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, Plan $plan): bool
    {
        return false;
    }
}
