<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Member;
use App\Models\User;

class MemberPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Receptionniste);
    }

    public function view(User $user, Member $member): bool
    {
        return $user->hasRole(Role::Admin, Role::Receptionniste);
    }

    public function create(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Receptionniste);
    }

    public function update(User $user, Member $member): bool
    {
        return $user->hasRole(Role::Admin, Role::Receptionniste) && ! $member->anonymise_at;
    }

    /** Archiver, anonymiser, régénérer le QR, exporter : réservé au patron. */
    public function manage(User $user, Member $member): bool
    {
        return $user->isAdmin();
    }

    /** Aucune suppression physique, pour personne. */
    public function delete(User $user, Member $member): bool
    {
        return false;
    }
}
