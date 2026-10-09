<?php

use App\Http\Middleware\EnsureAccountIsUsable;
use App\Http\Middleware\EnsurePasswordChanged;
use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Authentification de la SPA par cookies de session (Sanctum), avec protection CSRF.
        $middleware->statefulApi();
        $middleware->append(SecurityHeaders::class);
        $middleware->trustProxies(at: env('TRUSTED_PROXIES', '127.0.0.1'));

        $middleware->alias([
            'role' => EnsureRole::class,
            'account.usable' => EnsureAccountIsUsable::class,
            'password.changed' => EnsurePasswordChanged::class,
        ]);

        // API pure : jamais de redirection vers une page de connexion.
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Messages en français, clairs et actionnables.
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            return response()->json(['message' => 'Vous devez être connecté.', 'code' => 'NON_AUTHENTIFIE'], 401);
        });
        $exceptions->render(function (AuthorizationException|AccessDeniedHttpException $e, Request $request) {
            $message = $e->getMessage();
            if ($message === '' || $message === 'This action is unauthorized.') {
                $message = 'Action non autorisée pour votre rôle.';
            }

            return response()->json(['message' => $message, 'code' => 'INTERDIT'], 403);
        });
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                $isModel = $e->getPrevious() instanceof ModelNotFoundException;

                return response()->json([
                    'message' => $isModel ? 'Élément introuvable.' : 'Ressource introuvable.',
                    'code' => 'INTROUVABLE',
                ], 404);
            }
        });
        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            return response()->json([
                'message' => 'Trop de tentatives. Patientez avant de réessayer.',
                'code' => 'TROP_DE_TENTATIVES',
                'retry_after' => (int) ($e->getHeaders()['Retry-After'] ?? 60),
            ], 429, $e->getHeaders());
        });
    })->create();
