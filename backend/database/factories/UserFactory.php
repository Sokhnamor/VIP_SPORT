<?php

namespace Database\Factories;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /** Mot de passe des comptes de test. */
    public const PASSWORD = 'MotDePasse2026';

    protected static ?string $password;

    public function definition(): array
    {
        return [
            'nom' => fake()->name(),
            'identifiant' => fake()->unique()->userName(),
            'password' => static::$password ??= Hash::make(self::PASSWORD),
            'role' => Role::Receptionniste,
            'actif' => true,
            'doit_changer_mdp' => false,
            'derniere_connexion' => null,
            'remember_token' => Str::random(10),
        ];
    }

    public function admin(): static
    {
        return $this->state(fn () => ['role' => Role::Admin]);
    }

    public function receptionniste(): static
    {
        return $this->state(fn () => ['role' => Role::Receptionniste]);
    }

    public function scanner(): static
    {
        return $this->state(fn () => ['role' => Role::Scanner]);
    }

    public function inactif(): static
    {
        return $this->state(fn () => ['actif' => false]);
    }
}
