<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restreint une route à certains rôles : ->middleware('role:admin,receptionniste').
 * Tout autre rôle reçoit 403 (le compte scanner n'accède ainsi qu'au scan).
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        $allowed = array_map(fn (string $role) => Role::from($role), $roles);

        if (! $user || ! $user->hasRole(...$allowed)) {
            abort(403, 'Accès refusé pour votre rôle.');
        }

        return $next($request);
    }
}
