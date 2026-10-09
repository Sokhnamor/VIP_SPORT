<?php

namespace Database\Factories;

use App\Enums\MemberStatus;
use App\Models\Member;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Member>
 */
class MemberFactory extends Factory
{
    private const PRENOMS = ['Moussa', 'Awa', 'Ibrahima', 'Fatou', 'Cheikh', 'Aminata', 'Mamadou', 'Khady', 'Ousmane', 'Mariama', 'Abdoulaye', 'Ndèye', 'Babacar', 'Coumba', 'Serigne', 'Aïssatou'];

    private const NOMS = ['Diop', 'Ndiaye', 'Fall', 'Sow', 'Diallo', 'Gueye', 'Sarr', 'Faye', 'Ba', 'Mbaye', 'Cissé', 'Thiam', 'Seck', 'Kane', 'Niang', 'Dièye'];

    public function definition(): array
    {
        return [
            'nom' => fake()->randomElement(self::NOMS),
            'prenom' => fake()->randomElement(self::PRENOMS),
            'telephone' => '+221'.fake()->randomElement(['70', '76', '77', '78']).fake()->unique()->numerify('#######'),
            'email' => null,
            'sexe' => fake()->randomElement(['M', 'F']),
            'date_inscription' => now()->toDateString(),
            'statut' => MemberStatus::Actif,
        ];
    }
}
