<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use Database\Factories\UserFactory;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Scénarios §11.3 et §11.11 : droits par rôle, vérifiés côté serveur. */
class PermissionTest extends TestCase
{
    /** @return array<string, array{0: string, 1: string}> */
    public static function routesInterditesAuScanner(): array
    {
        return [
            'liste membres' => ['get', '/api/v1/members'],
            'création membre' => ['post', '/api/v1/members'],
            'formules' => ['get', '/api/v1/plans'],
            'vente abonnement' => ['post', '/api/v1/sales/subscription'],
            'vente ticket' => ['post', '/api/v1/sales/ticket'],
            'paiements' => ['get', '/api/v1/payments'],
            'caisse' => ['get', '/api/v1/cash-sessions/current'],
            'ouverture caisse' => ['post', '/api/v1/cash-sessions'],
            'dépenses' => ['get', '/api/v1/expenses'],
            'présences' => ['get', '/api/v1/presences/today'],
            'entrée manuelle' => ['post', '/api/v1/access/manual'],
            'tableau de bord' => ['get', '/api/v1/dashboard'],
            'rapports' => ['get', '/api/v1/reports/periode'],
            'alertes' => ['get', '/api/v1/alerts'],
            'utilisateurs' => ['get', '/api/v1/users'],
            'audit' => ['get', '/api/v1/audit-logs'],
            'paramètres' => ['put', '/api/v1/settings'],
            'journal accès' => ['get', '/api/v1/access-logs'],
        ];
    }

    #[DataProvider('routesInterditesAuScanner')]
    public function test_le_compte_scanner_n_accede_qu_au_scan(string $method, string $uri): void
    {
        $this->actingAs($this->scanner)->json($method, $uri)->assertStatus(403);
    }

    public function test_le_compte_scanner_peut_scanner(): void
    {
        $this->scan('M-INCONNU')->assertOk();
        $this->actingAs($this->scanner)->getJson('/api/v1/scan/stats')->assertOk();
    }

    /** @return array<string, array{0: string, 1: string}> */
    public static function routesAdmin(): array
    {
        return [
            'tableau de bord' => ['get', '/api/v1/dashboard'],
            'rapports' => ['get', '/api/v1/reports/periode'],
            'export rapport' => ['get', '/api/v1/reports/paiements?format=csv'],
            'alertes' => ['get', '/api/v1/alerts'],
            'utilisateurs' => ['get', '/api/v1/users'],
            'audit' => ['get', '/api/v1/audit-logs'],
            'paramètres' => ['put', '/api/v1/settings'],
            'nouvelle formule' => ['post', '/api/v1/plans'],
            'journal accès' => ['get', '/api/v1/access-logs'],
        ];
    }

    #[DataProvider('routesAdmin')]
    public function test_le_receptionniste_ne_voit_pas_les_donnees_globales(string $method, string $uri): void
    {
        $this->actingAs($this->reception)->json($method, $uri)->assertStatus(403);
    }

    public function test_le_receptionniste_ne_peut_pas_modifier_un_prix(): void
    {
        $this->actingAs($this->reception)
            ->putJson("/api/v1/plans/{$this->mensuel->id}", ['prix_fcfa' => 1000])
            ->assertStatus(403);

        $this->assertSame(20000, $this->mensuel->fresh()->prix_fcfa);
    }

    public function test_le_receptionniste_ne_peut_pas_accorder_de_reduction(): void
    {
        $this->openSession();

        $this->sellSubscription($this->member(), overrides: [
            'reduction' => 5000,
            'motif_reduction' => 'Ami',
            'montant_encaisse' => 15000,
        ])->assertStatus(403);

        $this->assertSame(0, Payment::count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'reduction.refusee', 'user_id' => $this->reception->id]);
    }

    public function test_une_reduction_autorisee_par_l_admin_sur_le_poste_est_acceptee(): void
    {
        $this->openSession();

        $this->sellSubscription($this->member(), overrides: [
            'reduction' => 5000,
            'motif_reduction' => 'Fidélité',
            'montant_encaisse' => 15000,
            'autorisation' => ['identifiant' => 'patron', 'mot_de_passe' => UserFactory::PASSWORD],
        ])->assertCreated()->assertJsonPath('data.reduction', 5000);

        $payment = $this->lastPayment();
        $this->assertSame($this->admin->id, $payment->reduction_autorisee_par);
        $this->assertSame($this->reception->id, $payment->user_id);
    }

    public function test_une_fausse_autorisation_admin_est_refusee(): void
    {
        $this->openSession();

        $this->sellSubscription($this->member(), overrides: [
            'reduction' => 5000,
            'motif_reduction' => 'Fidélité',
            'montant_encaisse' => 15000,
            'autorisation' => ['identifiant' => 'patron', 'mot_de_passe' => 'devine'],
        ])->assertStatus(403);

        $this->assertSame(0, Payment::count());
    }

    public function test_le_receptionniste_ne_peut_ni_annuler_ni_modifier_ni_supprimer_un_paiement(): void
    {
        $this->memberWithSubscription();
        $payment = $this->lastPayment();

        $this->actingAs($this->reception)->postJson("/api/v1/payments/{$payment->id}/cancel", ['motif' => 'Erreur'])->assertStatus(403);
        $this->actingAs($this->reception)->putJson("/api/v1/payments/{$payment->id}", ['montant_encaisse' => 1])->assertStatus(403);
        $this->actingAs($this->reception)->deleteJson("/api/v1/payments/{$payment->id}")->assertStatus(403);

        $this->assertNull($payment->fresh()->cancellation);
    }

    public function test_meme_l_admin_ne_peut_ni_modifier_ni_supprimer_un_paiement(): void
    {
        $this->memberWithSubscription();
        $payment = $this->lastPayment();

        $this->actingAs($this->admin)->putJson("/api/v1/payments/{$payment->id}", ['montant_encaisse' => 1])->assertStatus(403);
        $this->actingAs($this->admin)->deleteJson("/api/v1/payments/{$payment->id}")->assertStatus(403);
        $this->assertSame(20000, $payment->fresh()->montant_encaisse);
    }

    public function test_le_receptionniste_ne_peut_pas_archiver_ni_regenerer_un_qr(): void
    {
        $member = $this->memberWithSubscription();

        $this->actingAs($this->reception)->postJson("/api/v1/members/{$member->id}/archive")->assertStatus(403);
        $this->actingAs($this->reception)->postJson("/api/v1/members/{$member->id}/regenerate-qr")->assertStatus(403);
        $this->actingAs($this->reception)->getJson("/api/v1/members/{$member->id}/export")->assertStatus(403);
    }

    public function test_le_receptionniste_ne_voit_que_ses_paiements_et_ses_caisses(): void
    {
        $this->memberWithSubscription();
        $autre = User::factory()->receptionniste()->create();
        $sessionAutre = $this->openSession($autre);

        $this->actingAs($this->reception)->getJson('/api/v1/payments')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($autre)->getJson('/api/v1/payments')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($this->reception)->getJson("/api/v1/cash-sessions/{$sessionAutre->id}")->assertStatus(403);
    }
}
