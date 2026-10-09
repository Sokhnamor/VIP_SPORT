<?php

namespace Database\Seeders;

use App\Enums\AccessType;
use App\Enums\ExpenseCategory;
use App\Enums\ExpenseStatus;
use App\Enums\PaymentMode;
use App\Enums\Role;
use App\Models\Member;
use App\Models\Plan;
use App\Models\User;
use App\Services\AccessControlService;
use App\Services\CashSessionService;
use App\Services\ExpenseService;
use App\Services\PaymentService;
use App\Support\Dates;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * Jeu de démonstration (SEED_DEMO=true) : 45 jours d'activité rejoués via les vrais services
 * (ventes, caisses, scans, dépenses), pour que toutes les règles métier soient respectées.
 * Mot de passe des comptes de démo : Demo-Gym-2026 (à ne jamais utiliser en production).
 */
class DemoSeeder extends Seeder
{
    private const PASSWORD = 'Demo-Gym-2026';

    public function run(
        PaymentService $payments,
        CashSessionService $cash,
        AccessControlService $access,
        ExpenseService $expenses,
    ): void {
        if (Member::query()->exists()) {
            $this->command->warn('Des membres existent déjà : jeu de démonstration ignoré.');

            return;
        }

        $admin = User::query()->where('role', Role::Admin->value)->firstOrFail();
        $awa = $this->user('Awa Ndiaye', 'awa', Role::Receptionniste);
        $modou = $this->user('Modou Fall', 'modou', Role::Receptionniste);
        $porte = $this->user('Poste entrée', 'scan-porte', Role::Scanner);

        $plans = Plan::query()->get()->keyBy('nom');
        $seance = $plans['Séance unique'];
        $abonnements = [$plans['Mensuel'], $plans['Mensuel'], $plans['Mensuel'], $plans['Trimestriel'], $plans['Semestriel'], $plans['Annuel']];

        // Date réelle figée AVANT tout voyage dans le temps.
        $today = Dates::today();
        $start = $today->subDays(45);
        // Sans Faker (dépendance de développement absente de l'image de production).
        $prenoms = ['Moussa', 'Awa', 'Ibrahima', 'Fatou', 'Cheikh', 'Aminata', 'Mamadou', 'Khady', 'Ousmane', 'Mariama', 'Abdoulaye', 'Ndèye', 'Babacar', 'Coumba', 'Serigne'];
        $noms = ['Diop', 'Ndiaye', 'Fall', 'Sow', 'Diallo', 'Gueye', 'Sarr', 'Faye', 'Ba', 'Mbaye', 'Cissé', 'Thiam', 'Seck', 'Kane', 'Niang'];
        $members = collect(range(1, 45))->map(fn (int $i) => Member::create([
            'prenom' => $prenoms[$i % count($prenoms)],
            'nom' => $noms[intdiv($i, count($prenoms)) * 5 % count($noms) + $i % 5],
            'telephone' => '+22177'.str_pad((string) (1000000 + $i * 7919), 7, '0', STR_PAD_LEFT),
            'sexe' => $i % 2 ? 'M' : 'F',
            'date_inscription' => $start->toDateString(),
            'statut' => 'actif',
            'created_by' => $awa->id,
        ]));

        $toSell = $members->shuffle()->values();
        $modes = [PaymentMode::Especes, PaymentMode::Especes, PaymentMode::Especes, PaymentMode::Wave, PaymentMode::OrangeMoney];
        $ref = 1000;

        for ($d = 45; $d >= 0; $d--) {
            $day = $today->subDays($d);
            $cashier = $d % 2 === 0 ? $awa : $modou;

            $this->at($day->setTime(7, 30));
            $session = $cash->open($cashier, 10000);

            // Ventes d'abonnements : les premiers jours, la plupart des membres s'abonnent.
            $count = $d > 38 ? 6 : random_int(0, 2);
            for ($i = 0; $i < $count && $toSell->isNotEmpty(); $i++) {
                $this->at($day->setTime(8 + $i, random_int(0, 59)));
                $mode = $modes[array_rand($modes)];
                $plan = $abonnements[array_rand($abonnements)];
                $payments->sellSubscription($cashier, $toSell->shift(), $plan, [
                    'mode' => $mode->value,
                    'montant_encaisse' => $plan->prix_fcfa,
                    'reference_transaction' => $mode->requiresReference() ? 'DEMO'.$day->format('md').$ref++ : null,
                ]);
            }

            // Renouvellements des abonnements arrivés à échéance (environ 2 sur 3).
            foreach ($members as $member) {
                $fin = $member->coveredUntil();
                $last = $member->subscriptions()->max('date_fin');
                if (! $fin && $last && substr((string) $last, 0, 10) === $day->subDay()->toDateString() && random_int(1, 3) > 1) {
                    $this->at($day->setTime(17, random_int(0, 59)));
                    $plan = $plans['Mensuel'];
                    $payments->sellSubscription($cashier, $member, $plan, ['mode' => 'especes', 'montant_encaisse' => $plan->prix_fcfa]);
                }
            }

            // Séances à l'unité.
            for ($i = 0; $i < random_int(1, 4); $i++) {
                $this->at($day->setTime(random_int(9, 19), random_int(0, 59)));
                $payment = $payments->sellTicket($cashier, $seance, ['mode' => 'especes', 'montant_encaisse' => $seance->prix_fcfa]);
                if (random_int(1, 5) > 1) {
                    $this->at($day->setTime(20, random_int(0, 30)));
                    $access->scan($payment->ticket->qr_token, AccessType::Entree, $porte, '192.168.1.20');
                }
            }

            // Entrées des membres (heures de pointe : matin et soir).
            foreach ($members->random(min(25, $members->count())) as $member) {
                if (! $member->qr_token) {
                    $member->refresh();
                }
                if ($member->qr_token) {
                    $hour = random_int(1, 10) > 4 ? random_int(17, 20) : random_int(6, 9);
                    $this->at($day->setTime($hour, random_int(0, 59)));
                    $access->scan($member->qr_token, AccessType::Entree, $porte, '192.168.1.20');
                }
            }

            // Dépense ponctuelle payée depuis la caisse.
            if ($d % 9 === 0) {
                $this->at($day->setTime(12, 0));
                $expenses->create([
                    'date_depense' => $day->toDateString(),
                    'categorie' => ExpenseCategory::Entretien->value,
                    'montant' => 5000,
                    'description' => 'Produits d\'entretien',
                    'mode' => 'especes',
                    'payee_depuis_caisse' => true,
                ], null, $cashier);
            }

            // Clôture (sauf aujourd'hui) : parfois un petit écart.
            if ($d > 0) {
                $this->at($day->setTime(21, 45));
                $expected = $cash->summary($session)['especes_attendues'];
                $ecart = random_int(1, 8) === 1 ? -2000 : 0;
                $cash->close($session, $cashier, $expected + $ecart, $ecart ? 'Monnaie manquante, à vérifier' : null);
            }
        }

        // Dépenses du mois saisies par l'admin.
        $this->at($today->setTime(10, 0));
        foreach ([[ExpenseCategory::Loyer, 350000, 'Loyer du local'], [ExpenseCategory::Electricite, 85000, 'Facture Senelec'], [ExpenseCategory::Internet, 25000, 'Abonnement fibre']] as [$cat, $montant, $desc]) {
            $expenses->create([
                'date_depense' => $today->startOfMonth()->toDateString(),
                'categorie' => $cat->value,
                'montant' => $montant,
                'description' => $desc,
                'mode' => 'wave',
            ], null, $admin);
        }
        $pending = $expenses->create([
            'date_depense' => $today->toDateString(),
            'categorie' => ExpenseCategory::Materiel->value,
            'montant' => 15000,
            'description' => 'Bandes élastiques',
            'mode' => 'especes',
        ], null, $awa);
        $this->command->info('Dépense en attente de validation créée (#'.$pending->id.', statut '.ExpenseStatus::EnAttente->value.').');

        Carbon::setTestNow();
        CarbonImmutable::setTestNow();

        // Les présences des jours passés sont clôturées comme le ferait la tâche planifiée.
        $access->closeOpenPresences();

        $this->command->info('Démo : comptes awa / modou (réception), scan-porte (scanner), mot de passe '.self::PASSWORD);
    }

    private function user(string $nom, string $identifiant, Role $role): User
    {
        return User::query()->firstOrCreate(['identifiant' => $identifiant], [
            'nom' => $nom,
            'password' => self::PASSWORD,
            'role' => $role,
            'actif' => true,
            'doit_changer_mdp' => false,
        ]);
    }

    /** Voyage dans le temps : les horodatages (UTC en base) suivent la journée simulée. */
    private function at(CarbonImmutable $local): void
    {
        $utc = $local->utc();
        Carbon::setTestNow($utc);
        CarbonImmutable::setTestNow($utc);
    }
}
