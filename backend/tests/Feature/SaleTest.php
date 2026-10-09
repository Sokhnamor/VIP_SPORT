<?php

namespace Tests\Feature;

use App\Enums\SubscriptionStatus;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\Ticket;
use App\Services\SubscriptionService;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use LogicException;
use RuntimeException;
use Tests\TestCase;

class SaleTest extends TestCase
{
    /** §11.1 : création du membre puis vente d'un Mensuel en espèces. */
    public function test_vente_mensuel_cree_paiement_abonnement_et_qr_ensemble(): void
    {
        $this->freeze('2026-10-09 10:00');
        $this->openSession();

        $memberId = $this->actingAs($this->reception)->postJson('/api/v1/members', [
            'nom' => 'Diop',
            'prenom' => 'Moussa',
            'telephone' => '77 123 45 67',
        ])->assertCreated()->assertJsonPath('data.a_un_qr', false)->json('data.id');

        $member = Member::findOrFail($memberId);
        $this->assertNull($member->qr_token, 'Pas de QR avant paiement.');

        $response = $this->sellSubscription($member)
            ->assertCreated()
            ->assertJsonPath('data.montant_du', 20000)
            ->assertJsonPath('data.montant_encaisse', 20000)
            ->assertJsonPath('data.mode', 'especes')
            ->assertJsonPath('data.abonnement.date_debut', '2026-10-09')
            ->assertJsonPath('data.abonnement.date_fin', '2026-11-07')
            ->assertJsonPath('data.abonnement.statut', 'actif');

        $this->assertMatchesRegularExpression('/^REC-2026-\d{6}$/', $response->json('data.numero_recu'));
        $this->assertSame('REC-2026-000001', $response->json('data.numero_recu'));

        $member->refresh();
        $this->assertStringStartsWith('M-', $member->qr_token);
        $this->assertGreaterThanOrEqual(34, strlen($member->qr_token), 'Jeton ≥ 128 bits.');

        $subscription = Subscription::sole();
        $this->assertSame(30, (int) $subscription->date_debut->diffInDays($subscription->date_fin) + 1);
        $this->assertSame($this->lastPayment()->id, $subscription->payment_id);
        $this->assertSame($this->reception->openCashSession->id, $this->lastPayment()->cash_session_id);
    }

    /** §11.2 : si l'enregistrement échoue, rien n'est créé (ni paiement, ni abonnement, ni QR, ni numéro). */
    public function test_atomicite_aucun_abonnement_ni_qr_si_echec(): void
    {
        $this->openSession();
        $member = $this->member();

        $this->mock(SubscriptionService::class, function ($mock) {
            $mock->shouldReceive('createForPayment')->andThrow(new RuntimeException('Panne simulée'));
        });

        $this->sellSubscription($member)->assertStatus(500);

        $this->assertSame(0, Payment::count());
        $this->assertSame(0, Subscription::count());
        $this->assertNull($member->fresh()->qr_token);
        $this->assertSame(0, (int) DB::table('receipt_counters')->value('dernier_numero'));
        $this->assertDatabaseMissing('audit_logs', ['action' => 'paiement.creation']);
    }

    public function test_numero_de_recu_sans_trou_apres_un_echec(): void
    {
        $this->freeze('2026-10-09 10:00');
        $this->openSession();
        $this->sellSubscription($this->member())->assertCreated();

        // Vente refusée (référence manquante) : aucun numéro consommé.
        $this->sellSubscription($this->member(), overrides: ['mode' => 'wave'])->assertStatus(422);

        $this->sellSubscription($this->member())->assertCreated();
        $this->sellTicket()->assertCreated();

        $this->assertSame(
            ['REC-2026-000001', 'REC-2026-000002', 'REC-2026-000003'],
            Payment::orderBy('id')->pluck('numero_recu')->all(),
        );
    }

    public function test_impossible_de_creer_un_abonnement_sans_paiement(): void
    {
        $this->expectException(LogicException::class);

        app(SubscriptionService::class)->createForPayment($this->member(), $this->mensuel, new Payment);
    }

    public function test_vente_impossible_sans_session_de_caisse_ouverte(): void
    {
        $this->sellSubscription($this->member())
            ->assertStatus(422)
            ->assertJsonPath('code', 'CAISSE_NON_OUVERTE');

        $this->assertSame(0, Payment::count());
    }

    /** §11.4 : Wave sans référence refusé ; référence réutilisée refusée. */
    public function test_paiement_wave_exige_une_reference_unique(): void
    {
        $this->openSession();

        $this->sellSubscription($this->member(), overrides: ['mode' => 'wave'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('reference_transaction');

        $this->sellSubscription($this->member(), overrides: ['mode' => 'wave', 'reference_transaction' => 'WAVE-123'])
            ->assertCreated();

        $this->sellSubscription($this->member(), overrides: ['mode' => 'orange_money', 'reference_transaction' => 'WAVE-123'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('reference_transaction');

        $this->sellSubscription($this->member(), overrides: ['mode' => 'orange_money'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('reference_transaction');

        $this->assertSame(1, Payment::count());
    }

    public function test_le_montant_du_est_calcule_par_le_serveur(): void
    {
        $this->openSession();

        // Le client tente d'imposer un montant dû : ignoré.
        $this->sellSubscription($this->member(), overrides: ['montant_du' => 100, 'montant_encaisse' => 100])
            ->assertStatus(422)
            ->assertJsonValidationErrors('montant_encaisse');

        $this->sellSubscription($this->member(), overrides: ['montant_du' => 100])
            ->assertCreated()
            ->assertJsonPath('data.montant_du', 20000);
    }

    public function test_changer_un_tarif_n_altere_pas_l_historique(): void
    {
        $this->memberWithSubscription();

        $this->actingAs($this->admin)->putJson("/api/v1/plans/{$this->mensuel->id}", ['prix_fcfa' => 25000])->assertOk();

        $this->assertSame(20000, $this->lastPayment()->montant_du);
        $this->assertDatabaseHas('audit_logs', ['action' => 'formule.modification']);
    }

    /** Immuabilité : aucun update ni delete d'un paiement, même en code. */
    public function test_un_paiement_est_immuable(): void
    {
        $this->memberWithSubscription();
        $payment = $this->lastPayment();

        try {
            $payment->update(['montant_encaisse' => 1]);
            $this->fail('La modification aurait dû être refusée.');
        } catch (LogicException) {
        }

        try {
            $payment->delete();
            $this->fail('La suppression aurait dû être refusée.');
        } catch (LogicException) {
        }

        $this->assertSame(20000, $payment->fresh()->montant_encaisse);
    }

    /** Défense en profondeur : même en SQL direct, MySQL refuse de modifier ou supprimer un paiement. */
    public function test_la_base_mysql_refuse_toute_modification_d_un_paiement(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            $this->markTestSkipped('Triggers d\'immuabilité : MySQL uniquement.');
        }

        $this->memberWithSubscription();
        $id = $this->lastPayment()->id;

        foreach ([
            fn () => DB::table('payments')->where('id', $id)->update(['montant_encaisse' => 1]),
            fn () => DB::table('payments')->where('id', $id)->delete(),
            fn () => DB::table('audit_logs')->delete(),
        ] as $attempt) {
            try {
                $attempt();
                $this->fail('La base aurait dû refuser l\'opération.');
            } catch (QueryException $e) {
                $this->assertStringContainsString('lecture seule', $e->getMessage());
            }
        }

        $this->assertSame(20000, (int) DB::table('payments')->where('id', $id)->value('montant_encaisse'));
    }

    /** §11.7 (partie paiement) : l'annulation crée un enregistrement lié, le paiement reste intact. */
    public function test_annulation_par_l_admin_annule_l_abonnement(): void
    {
        $member = $this->memberWithSubscription();
        $payment = $this->lastPayment();

        $this->actingAs($this->admin)->postJson("/api/v1/payments/{$payment->id}/cancel", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('motif');

        $this->actingAs($this->admin)->postJson("/api/v1/payments/{$payment->id}/cancel", ['motif' => 'Erreur de saisie'])
            ->assertOk()
            ->assertJsonPath('data.annule', true)
            ->assertJsonPath('data.annulation.motif', 'Erreur de saisie');

        $this->assertSame(SubscriptionStatus::Annule, $member->subscriptions()->sole()->statut);
        $this->assertSame(20000, $payment->fresh()->montant_encaisse, 'Le paiement d\'origine est conservé.');

        $this->actingAs($this->admin)->postJson("/api/v1/payments/{$payment->id}/cancel", ['motif' => 'Encore'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'PAIEMENT_DEJA_ANNULE');
    }

    /** §11.12 : renouvellement anticipé : la nouvelle période commence le lendemain de l'ancienne fin. */
    public function test_renouvellement_anticipe_enchaine_les_periodes(): void
    {
        $this->freeze('2026-10-09 10:00');
        $member = $this->memberWithSubscription();

        $this->freeze('2026-11-01 10:00');
        $this->sellSubscription($member)
            ->assertCreated()
            ->assertJsonPath('data.abonnement.date_debut', '2026-11-08')
            ->assertJsonPath('data.abonnement.date_fin', '2026-12-07')
            ->assertJsonPath('data.abonnement.statut', 'a_venir');

        // Un troisième s'enchaîne après le deuxième.
        $this->sellSubscription($member)
            ->assertCreated()
            ->assertJsonPath('data.abonnement.date_debut', '2026-12-08');

        $this->assertSame('2027-01-06', $member->fresh()->coveredUntil());
    }

    public function test_apres_expiration_le_renouvellement_commence_aujourd_hui(): void
    {
        $this->freeze('2026-10-09 10:00');
        $member = $this->memberWithSubscription();

        $this->freeze('2026-12-01 10:00');
        $this->sellSubscription($member)
            ->assertCreated()
            ->assertJsonPath('data.abonnement.date_debut', '2026-12-01');
    }

    public function test_recapitulatif_avant_vente_calcule_par_le_serveur(): void
    {
        $this->freeze('2026-10-09 10:00');
        $member = $this->memberWithSubscription();

        $this->actingAs($this->reception)->getJson("/api/v1/members/{$member->id}/quote?plan_id={$this->mensuel->id}")
            ->assertOk()
            ->assertJsonPath('data.montant_du', 20000)
            ->assertJsonPath('data.date_debut', '2026-11-08')
            ->assertJsonPath('data.renouvellement_anticipe', true);
    }

    public function test_vente_d_une_seance_cree_un_ticket_du_jour(): void
    {
        $this->freeze('2026-10-09 10:00');
        $this->openSession();

        $response = $this->sellTicket()->assertCreated()
            ->assertJsonPath('data.ticket.valable_le', '2026-10-09')
            ->assertJsonPath('data.ticket.statut', 'valide');

        $this->assertMatchesRegularExpression('/^T-[A-Z0-9]{8}$/', $response->json('data.ticket.numero'));
        $ticket = Ticket::sole();
        $this->assertStringStartsWith('T-', $ticket->qr_token);
        $this->assertSame(0, Subscription::count(), 'Une séance ne crée pas d\'abonnement.');

        $this->actingAs($this->reception)->getJson("/api/v1/tickets/{$ticket->id}")
            ->assertOk()
            ->assertJsonStructure(['data', 'qr_data_uri', 'whatsapp_url']);
    }

    public function test_une_seance_ne_peut_pas_etre_vendue_comme_abonnement(): void
    {
        $this->openSession();

        $this->sellSubscription($this->member(), $this->seance)->assertStatus(422)->assertJsonPath('code', 'FORMULE_SEANCE');
    }

    public function test_formule_inactive_non_vendable(): void
    {
        $this->openSession();
        $this->mensuel->update(['actif' => false]);

        $this->sellSubscription($this->member())->assertStatus(422)->assertJsonPath('code', 'FORMULE_INACTIVE');
    }

    public function test_recu_pdf_imprimable_en_a5_et_80mm(): void
    {
        $this->memberWithSubscription();
        $payment = $this->lastPayment();

        $this->actingAs($this->reception)->get("/api/v1/payments/{$payment->id}/receipt")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->actingAs($this->reception)->get("/api/v1/payments/{$payment->id}/receipt?format=80mm")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_carte_de_membre_pdf(): void
    {
        $member = $this->memberWithSubscription();

        $this->actingAs($this->reception)->get("/api/v1/members/{$member->id}/card")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->actingAs($this->reception)->get("/api/v1/members/{$member->id}/qr")
            ->assertOk()->assertHeader('Content-Type', 'image/svg+xml');
    }
}
