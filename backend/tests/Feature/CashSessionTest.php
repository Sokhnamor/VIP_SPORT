<?php

namespace Tests\Feature;

use App\Models\CashSession;
use App\Models\Plan;
use LogicException;
use Tests\TestCase;

class CashSessionTest extends TestCase
{
    /** §11.10 : attendu 150 000, compté 145 000 → écart −5 000, motif obligatoire, session verrouillée, visible admin. */
    public function test_cloture_avec_ecart_negatif(): void
    {
        $session = $this->actingAs($this->reception)->postJson('/api/v1/cash-sessions', ['fond_initial' => 30000])
            ->assertCreated()
            ->json('data');

        // 30 000 de fond + 6 × 20 000 encaissés en espèces = 150 000 attendus.
        for ($i = 0; $i < 6; $i++) {
            $this->sellSubscription($this->member())->assertCreated();
        }
        // Les paiements Wave ne comptent pas dans les espèces attendues.
        $this->sellSubscription($this->member(), overrides: ['mode' => 'wave', 'reference_transaction' => 'W-1'])->assertCreated();

        $this->actingAs($this->reception)->getJson('/api/v1/cash-sessions/current')
            ->assertJsonPath('data.totaux.especes_attendues', 150000)
            ->assertJsonPath('data.totaux.wave', 20000);

        $this->actingAs($this->reception)->postJson("/api/v1/cash-sessions/{$session['id']}/close", ['especes_comptees' => 145000])
            ->assertStatus(422)
            ->assertJsonValidationErrors('motif_ecart');

        $this->actingAs($this->reception)->postJson("/api/v1/cash-sessions/{$session['id']}/close", [
            'especes_comptees' => 145000,
            'motif_ecart' => 'Erreur de rendu de monnaie',
        ])->assertOk()
            ->assertJsonPath('data.especes_attendues', 150000)
            ->assertJsonPath('data.especes_comptees', 145000)
            ->assertJsonPath('data.ecart', -5000)
            ->assertJsonPath('data.statut', 'cloturee');

        // Verrouillée : plus de vente possible sur cette session, ni de seconde clôture.
        $this->sellSubscription($this->member())->assertStatus(422)->assertJsonPath('code', 'CAISSE_NON_OUVERTE');
        $this->actingAs($this->reception)->postJson("/api/v1/cash-sessions/{$session['id']}/close", ['especes_comptees' => 150000])
            ->assertStatus(422);

        // Visible dans le tableau de bord admin.
        $this->actingAs($this->admin)->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('data.ecarts_caisse.0.ecart', -5000)
            ->assertJsonPath('data.ecarts_caisse.0.motif_ecart', 'Erreur de rendu de monnaie');

        $this->assertDatabaseHas('audit_logs', ['action' => 'caisse.cloture', 'entite_id' => $session['id']]);
    }

    public function test_cloture_sans_ecart_ne_demande_pas_de_motif(): void
    {
        $session = $this->openSession(fond: 10000);
        $this->sellSubscription($this->member())->assertCreated();

        $this->actingAs($this->reception)->postJson("/api/v1/cash-sessions/{$session->id}/close", ['especes_comptees' => 30000])
            ->assertOk()
            ->assertJsonPath('data.ecart', 0);
    }

    public function test_une_seule_session_ouverte_par_receptionniste(): void
    {
        $this->openSession();

        $this->actingAs($this->reception)->postJson('/api/v1/cash-sessions', ['fond_initial' => 0])
            ->assertStatus(422)
            ->assertJsonPath('code', 'CAISSE_DEJA_OUVERTE');
    }

    public function test_seul_l_employe_qui_a_ouvert_peut_cloturer(): void
    {
        $session = $this->openSession();

        $this->actingAs($this->admin)->postJson("/api/v1/cash-sessions/{$session->id}/close", ['especes_comptees' => 0])
            ->assertStatus(403);
    }

    public function test_l_admin_commente_mais_ne_modifie_jamais_une_cloture(): void
    {
        $session = $this->openSession();
        $this->actingAs($this->reception)->postJson("/api/v1/cash-sessions/{$session->id}/close", [
            'especes_comptees' => 0,
        ])->assertOk();

        $this->actingAs($this->admin)->postJson("/api/v1/cash-sessions/{$session->id}/comment", ['commentaire' => 'Vu, RAS'])
            ->assertOk()
            ->assertJsonPath('data.commentaire_admin', 'Vu, RAS')
            ->assertJsonPath('data.ecart', 0);

        $this->actingAs($this->reception)->postJson("/api/v1/cash-sessions/{$session->id}/comment", ['commentaire' => 'x'])
            ->assertStatus(403);

        $this->expectException(LogicException::class);
        CashSession::findOrFail($session->id)->update(['especes_comptees' => 999999]);
    }

    public function test_les_depenses_payees_en_caisse_sont_deduites_et_les_annulations_exclues(): void
    {
        $session = $this->openSession(fond: 5000);
        $this->sellSubscription($this->member())->assertCreated();
        $this->sellSubscription($this->member())->assertCreated();
        $annule = $this->lastPayment();

        $this->actingAs($this->reception)->postJson('/api/v1/expenses', [
            'date_depense' => now()->toDateString(),
            'categorie' => 'entretien',
            'montant' => 3000,
            'description' => 'Savon',
            'mode' => 'especes',
            'payee_depuis_caisse' => true,
        ])->assertCreated()->assertJsonPath('data.payee_depuis_caisse', true);

        $this->actingAs($this->admin)->postJson("/api/v1/payments/{$annule->id}/cancel", ['motif' => 'Erreur'])->assertOk();

        // 5 000 + 20 000 (un seul paiement non annulé) − 3 000 = 22 000
        $this->actingAs($this->reception)->getJson("/api/v1/cash-sessions/{$session->id}")
            ->assertJsonPath('data.totaux.especes_attendues', 22000)
            ->assertJsonPath('data.totaux.nombre_annulations', 1);
    }

    public function test_liste_de_rapprochement_mobile_money(): void
    {
        $session = $this->openSession();
        $this->sellSubscription($this->member(), overrides: ['mode' => 'wave', 'reference_transaction' => 'WV-001'])->assertCreated();
        $this->sellSubscription($this->member(), overrides: ['mode' => 'orange_money', 'reference_transaction' => 'OM-001'])->assertCreated();
        $this->sellSubscription($this->member())->assertCreated();

        $this->actingAs($this->reception)->getJson("/api/v1/cash-sessions/{$session->id}/mobile-money")
            ->assertOk()->assertJsonCount(2, 'data');
        $this->actingAs($this->reception)->get("/api/v1/cash-sessions/{$session->id}/mobile-money?format=pdf")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_oubli_de_cloture_signale_le_lendemain(): void
    {
        $this->freeze('2026-10-09 08:00');
        $this->openSession();

        $this->freeze('2026-10-10 09:00');
        $this->actingAs($this->admin)->getJson('/api/v1/alerts')
            ->assertOk()
            ->assertJsonPath('data.resume.caisses_non_cloturees', 1)
            ->assertJsonPath('data.caisses_non_cloturees.0.oubli_cloture', true);
    }

    public function test_admin_peut_vendre_avec_sa_propre_caisse(): void
    {
        $this->openSession($this->admin);
        $plan = Plan::factory()->create(['prix_fcfa' => 10000]);

        $this->sellSubscription($this->member(), $plan, ['reduction' => 2000, 'motif_reduction' => 'Promo', 'montant_encaisse' => 8000], $this->admin)
            ->assertCreated()
            ->assertJsonPath('data.reduction', 2000);
    }
}
