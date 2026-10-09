<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ChangePasswordRequest;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::query()->where('identifiant', $request->input('identifiant'))->first();
        $valid = $user && Hash::check($request->input('mot_de_passe'), $user->password);

        if (! $valid || ! $user->actif) {
            $this->audit->log('auth.echec', $user, null, [
                'identifiant' => $request->input('identifiant'),
                'raison' => $valid ? 'compte_desactive' : 'identifiants_invalides',
            ], $user);

            throw ValidationException::withMessages([
                'identifiant' => $valid ? 'Ce compte est désactivé. Contactez l\'administrateur.' : 'Identifiant ou mot de passe incorrect.',
            ]);
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $request->session()->put('derniere_activite', time());

        $user->forceFill(['derniere_connexion' => now()])->save();
        $this->audit->log('auth.connexion', $user, null, null, $user);

        return response()->json(['data' => new UserResource($user)]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->audit->log('auth.deconnexion', $user, null, null, $user);

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Déconnecté.']);
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->forceFill([
            'password' => $request->input('nouveau_mot_de_passe'),
            'doit_changer_mdp' => false,
        ])->save();

        // Les autres sessions éventuelles de ce compte sont invalidées.
        Auth::guard('web')->logoutOtherDevices($request->input('nouveau_mot_de_passe'));
        $request->session()->regenerate();

        $this->audit->log('auth.changement_mot_de_passe', $user, null, null, $user);

        return response()->json(['data' => new UserResource($user), 'message' => 'Mot de passe modifié.']);
    }
}
