<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\CashSession;
use App\Models\User;

class CashSessionPolicy
{
    public function open(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Receptionniste);
    }

    public function viewAny(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Receptionniste);
    }

    /** Un réceptionniste ne voit que ses propres sessions ; l'admin voit tout. */
    public function view(User $user, CashSession $session): bool
    {
        return $user->isAdmin() || $session->user_id === $user->id;
    }

    public function close(User $user, CashSession $session): bool
    {
        return $session->user_id === $user->id;
    }

    public function comment(User $user, CashSession $session): bool
    {
        return $user->isAdmin();
    }

    public function update(User $user, CashSession $session): bool
    {
        return false;
    }

    public function delete(User $user, CashSession $session): bool
    {
        return false;
    }
}
