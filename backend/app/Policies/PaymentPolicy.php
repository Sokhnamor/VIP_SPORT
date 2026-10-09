<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Payment;
use App\Models\User;

class PaymentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Receptionniste);
    }

    /** Le réceptionniste voit ses encaissements et ceux des membres (fiche, réimpression du reçu). */
    public function view(User $user, Payment $payment): bool
    {
        return $user->hasRole(Role::Admin, Role::Receptionniste);
    }

    public function create(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Receptionniste);
    }

    public function cancel(User $user, Payment $payment): bool
    {
        return $user->isAdmin();
    }

    /** Immuabilité : personne ne modifie ni ne supprime un paiement. */
    public function update(User $user, Payment $payment): bool
    {
        return false;
    }

    public function delete(User $user, Payment $payment): bool
    {
        return false;
    }
}
