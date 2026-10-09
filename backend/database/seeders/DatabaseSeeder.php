<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Plan;
use App\Models\Setting;
use App\Models\User;
use App\Support\Settings;
use Illuminate\Database\Seeder;

/**
 * Données initiales : compte admin (mot de passe à changer à la première connexion),
 * formules, paramètres. Le jeu de démonstration n'est chargé que si SEED_DEMO=true.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedAdmin();
        $this->seedPlans();
        $this->seedSettings();

        if (config('gym.seed.demo')) {
            $this->call(DemoSeeder::class);
        }
    }

    private function seedAdmin(): void
    {
        $identifiant = config('gym.seed.admin_identifiant');
        $password = config('gym.seed.admin_password');

        if (User::query()->where('identifiant', $identifiant)->exists()) {
            return;
        }

        if (! $password) {
            $password = 'Gym-'.bin2hex(random_bytes(6));
            $this->command->warn("Mot de passe admin provisoire : {$password} (à changer à la première connexion)");
        }

        User::create([
            'nom' => 'Administrateur',
            'identifiant' => $identifiant,
            'password' => $password,
            'role' => Role::Admin,
            'actif' => true,
            'doit_changer_mdp' => true,
        ]);
    }

    /** Formules initiales : prix indicatifs, à ajuster par le patron dans l'écran Formules. */
    private function seedPlans(): void
    {
        $plans = [
            ['nom' => 'Séance unique', 'duree_jours' => 1, 'prix_fcfa' => 2000, 'est_seance' => true],
            ['nom' => 'Mensuel', 'duree_jours' => 30, 'prix_fcfa' => 20000, 'est_seance' => false],
            ['nom' => 'Trimestriel', 'duree_jours' => 90, 'prix_fcfa' => 55000, 'est_seance' => false],
            ['nom' => 'Semestriel', 'duree_jours' => 180, 'prix_fcfa' => 100000, 'est_seance' => false],
            ['nom' => 'Annuel', 'duree_jours' => 365, 'prix_fcfa' => 180000, 'est_seance' => false],
        ];

        foreach ($plans as $plan) {
            Plan::query()->firstOrCreate(['nom' => $plan['nom']], $plan + ['actif' => true]);
        }
    }

    private function seedSettings(): void
    {
        $defaults = config('gym.defaults');
        $defaults['nom_salle'] = config('gym.seed.nom_salle') ?: $defaults['nom_salle'];

        foreach ($defaults as $key => $value) {
            if (Setting::query()->where('cle', $key)->doesntExist()) {
                Settings::put([$key => $value]);
            }
        }
    }
}
