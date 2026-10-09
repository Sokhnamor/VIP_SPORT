<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Http\Requests\UserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;

/** Gestion des comptes (admin) : un compte par employé, jamais de suppression (désactivation). */
class UserController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index()
    {
        return UserResource::collection(User::query()->orderBy('actif', 'desc')->orderBy('nom')->get());
    }

    public function store(UserRequest $request)
    {
        $data = $request->validated();

        $user = User::create([
            'nom' => $data['nom'],
            'identifiant' => $data['identifiant'],
            'role' => $data['role'],
            'actif' => $data['actif'] ?? true,
            'password' => $data['mot_de_passe'],
            // Mot de passe provisoire : l'employé le change à sa première connexion.
            'doit_changer_mdp' => true,
        ]);

        $this->audit->log('utilisateur.creation', $user, null, $user->only(['nom', 'identifiant', 'role', 'actif']));

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    public function update(UserRequest $request, User $user)
    {
        $data = $request->validated();
        $this->guardLastAdmin($request->user(), $user, $data);

        $user->fill($data);
        [$avant, $apres] = $this->audit->diff($user);
        $user->save();

        if ($apres !== []) {
            $this->audit->log('utilisateur.modification', $user, $avant, $apres);
        }

        // Compte désactivé : ses sessions ouvertes sont supprimées immédiatement.
        if (array_key_exists('actif', $data) && ! $data['actif']) {
            DB::table('sessions')->where('user_id', $user->id)->delete();
        }

        return new UserResource($user);
    }

    /** Réinitialisation par l'admin : mot de passe provisoire, à changer à la prochaine connexion. */
    public function resetPassword(Request $request, User $user)
    {
        $data = $request->validate(['mot_de_passe' => ['required', 'string', Password::defaults()]]);

        $user->forceFill(['password' => $data['mot_de_passe'], 'doit_changer_mdp' => true])->save();
        DB::table('sessions')->where('user_id', $user->id)->delete();

        $this->audit->log('utilisateur.reinitialisation_mot_de_passe', $user);

        return new UserResource($user);
    }

    /** Empêche l'admin de se retirer à lui-même (ou au dernier admin) les droits d'administration. */
    private function guardLastAdmin(User $actor, User $target, array $data): void
    {
        $losesAdmin = (isset($data['role']) && $data['role'] !== 'admin') || (array_key_exists('actif', $data) && ! $data['actif']);
        if (! $target->isAdmin() || ! $losesAdmin) {
            return;
        }

        if ($actor->is($target)) {
            throw new BusinessRuleException('Vous ne pouvez pas retirer vos propres droits d\'administrateur.', 'ADMIN_SOI_MEME');
        }

        $otherAdmins = User::query()->where('role', 'admin')->where('actif', true)->where('id', '!=', $target->id)->count();
        if ($otherAdmins === 0) {
            throw new BusinessRuleException('Il doit rester au moins un administrateur actif.', 'DERNIER_ADMIN');
        }
    }
}
