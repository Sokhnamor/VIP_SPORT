<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * - Compte désactivé par l'admin : session coupée immédiatement.
 * - Déconnexion automatique après inactivité : 30 min (admin, réceptionniste), 12 h (scanner).
 */
class EnsureAccountIsUsable
{
    private const SESSION_KEY = 'derniere_activite';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user) {
            return $next($request);
        }

        if (! $user->actif) {
            $this->logout($request);

            return response()->json(['message' => 'Compte désactivé.', 'code' => 'COMPTE_DESACTIVE'], 401);
        }

        if ($request->hasSession()) {
            $last = (int) $request->session()->get(self::SESSION_KEY, time());
            $timeout = $user->role->inactivityTimeout() * 60;

            if (time() - $last > $timeout) {
                $this->logout($request);

                return response()->json([
                    'message' => 'Session expirée après inactivité. Reconnectez-vous.',
                    'code' => 'SESSION_EXPIREE',
                ], 401);
            }

            $request->session()->put(self::SESSION_KEY, time());
        }

        return $next($request);
    }

    private function logout(Request $request): void
    {
        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }
    }
}
