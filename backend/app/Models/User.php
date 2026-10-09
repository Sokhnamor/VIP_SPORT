<?php

namespace App\Models;

use App\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $nom
 * @property string $identifiant
 * @property string $password
 * @property Role $role
 * @property bool $actif
 * @property bool $doit_changer_mdp
 * @property Carbon|null $derniere_connexion
 */
#[Fillable(['nom', 'identifiant', 'password', 'role', 'actif', 'doit_changer_mdp'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'role' => Role::class,
            'actif' => 'boolean',
            'doit_changer_mdp' => 'boolean',
            'derniere_connexion' => 'datetime',
        ];
    }

    public function hasRole(Role ...$roles): bool
    {
        return in_array($this->role, $roles, true);
    }

    public function isAdmin(): bool
    {
        return $this->role === Role::Admin;
    }

    /** @return HasMany<CashSession, $this> */
    public function cashSessions(): HasMany
    {
        return $this->hasMany(CashSession::class);
    }

    /**
     * Session de caisse actuellement ouverte (au plus une, garanti par index unique).
     *
     * @return HasOne<CashSession, $this>
     */
    public function openCashSession(): HasOne
    {
        return $this->hasOne(CashSession::class, 'verrou_ouverte');
    }
}
