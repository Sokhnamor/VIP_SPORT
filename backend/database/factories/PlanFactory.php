<?php

namespace Database\Factories;

use App\Models\Plan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Plan>
 */
class PlanFactory extends Factory
{
    public function definition(): array
    {
        return [
            'nom' => 'Formule '.fake()->unique()->word(),
            'duree_jours' => 30,
            'prix_fcfa' => 20000,
            'est_seance' => false,
            'actif' => true,
        ];
    }

    public function mensuel(): static
    {
        return $this->state(fn () => ['nom' => 'Mensuel', 'duree_jours' => 30, 'prix_fcfa' => 20000]);
    }

    public function seance(): static
    {
        return $this->state(fn () => ['nom' => 'Séance unique', 'duree_jours' => 1, 'prix_fcfa' => 2000, 'est_seance' => true]);
    }
}
