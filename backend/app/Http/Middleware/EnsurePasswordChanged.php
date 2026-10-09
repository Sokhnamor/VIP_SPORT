<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Tant que le mot de passe initial n'est pas changé, seules les routes d'authentification répondent. */
class EnsurePasswordChanged
{
    private const ALLOWED_ROUTES = ['auth.me', 'auth.logout', 'auth.password', 'settings.public'];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->doit_changer_mdp && ! in_array($request->route()?->getName(), self::ALLOWED_ROUTES, true)) {
            return response()->json([
                'message' => 'Vous devez changer votre mot de passe avant de continuer.',
                'code' => 'MOT_DE_PASSE_A_CHANGER',
            ], 403);
        }

        return $next($request);
    }
}
