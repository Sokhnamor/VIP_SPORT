<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // En développement : erreurs explicites sur les attributs non déclarés ou le lazy loading.
        Model::shouldBeStrict(! $this->app->isProduction());

        // Mot de passe fort obligatoire ; en production, refus des mots de passe ayant fuité.
        Password::defaults(function () {
            $rule = Password::min(10)->mixedCase()->numbers();

            return $this->app->isProduction() ? $rule->uncompromised() : $rule;
        });

        // Connexion : 5 tentatives par minute par identifiant + IP, 20 par IP.
        RateLimiter::for('login', function (Request $request) {
            $identifiant = strtolower((string) $request->input('identifiant'));

            return [
                Limit::perMinute(5)->by('login:'.$identifiant.'|'.$request->ip()),
                Limit::perMinute(20)->by('login-ip:'.$request->ip()),
            ];
        });

        // Poste de scan : débit global par appareil (compte + IP). Les jetons inconnus ont
        // une limite plus stricte, appliquée dans ScanController.
        RateLimiter::for('scan', function (Request $request) {
            return Limit::perMinute((int) config('gym.scan_rate_per_minute'))
                ->by('scan:'.$request->user()?->id.'|'.$request->ip());
        });

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(300)->by($request->user()?->id ?: $request->ip());
        });
    }
}
