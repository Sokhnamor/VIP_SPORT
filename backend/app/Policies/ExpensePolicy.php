<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Expense;
use App\Models\User;

class ExpensePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Receptionniste);
    }

    public function view(User $user, Expense $expense): bool
    {
        return $user->isAdmin() || $expense->user_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Receptionniste);
    }

    /** Valider, rejeter, annuler : admin uniquement. */
    public function decide(User $user, Expense $expense): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, Expense $expense): bool
    {
        return false;
    }
}
