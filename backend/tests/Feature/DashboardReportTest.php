<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\V1\ReportController;
use App\Models\Payment;
use App\Models\PaymentCancellation;
use App\Models\Plan;
use App\Models\User;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DashboardReportTest extends TestCase
{
    /** §11.14 : totaux = somme des paiements − annulations de la période. */
    public function test_les_totaux_correspondent_aux_paiements_moins_les_annulations(): void
    {
        $this->freeze('2026-10-09 09:00');
        $trimestriel = Plan::factory()->create(['nom' => 'Trimestriel', 'duree_jours' => 90, 'prix_fcfa' => 55000]);
        $this->openSession();

        $this->sellSubscription($this->member())->assertCreated();                                    // 20 000 espèces
        $this->sellSubscription($this->member(), $trimestriel, ['mode' => 'wave', 'reference_transaction' => 'W1'])->assertCreated(); // 55 000 wave
        $this->sellTicket()->assertCreated();                                                         // 2 000 espèces
        $this->sellSubscription($this->member())->assertCreated();                                    // 20 000, annulé
        $this->actingAs($this->admin)->postJson("/api/v1/payments/{$this->lastPayment()->id}/cancel", ['motif' => 'Erreur'])->assertOk();

        $sumPayments = (int) Payment::sum('montant_encaisse');
        $sumCancelled = (int) PaymentCancellation::query()->with('payment')->get()->sum(fn ($c) => $c->payment->montant_encaisse);
        $this->assertSame(97000, $sumPayments);
        $this->assertSame(77000, $sumPayments - $sumCancelled);

        $this->actingAs($this->admin)->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('data.recettes_jour.brut', 97000)
            ->assertJsonPath('data.recettes_jour.annulations', 20000)
            ->assertJsonPath('data.recettes_jour.net', 77000)
            ->assertJsonPath('data.recettes_mois.net', 77000)
            ->assertJsonPath('data.membres_actifs', 2);

        $parMode = collect($this->actingAs($this->admin)->getJson('/api/v1/reports/modes')->json('data'))->keyBy('cle');
        $this->assertSame(22000, $parMode['especes']['net']);
        $this->assertSame(55000, $parMode['wave']['net']);
        $this->assertSame($sumPayments - $sumCancelled, $parMode->sum('net'));

        $serie = collect($this->actingAs($this->admin)->getJson('/api/v1/dashboard')->json('data.recettes_30j'));
        $this->assertSame(77000, $serie->sum('net'));
        $this->assertSame(77000, $serie->firstWhere('date', '2026-10-09')['net']);
    }

    public function test_une_annulation_compte_a_sa_date_sans_modifier_le_passe(): void
    {
        $this->freeze('2026-10-09 09:00');
        $this->memberWithSubscription();
        $payment = $this->lastPayment();

        $this->freeze('2026-10-10 09:00');
        $this->actingAs($this->admin)->postJson("/api/v1/payments/{$payment->id}/cancel", ['motif' => 'Retour'])->assertOk();

        $this->actingAs($this->admin)->getJson('/api/v1/reports/journalier?du=2026-10-09')
            ->assertJsonPath('data.recettes.net', 20000);
        $this->actingAs($this->admin)->getJson('/api/v1/reports/journalier?du=2026-10-10')
            ->assertJsonPath('data.recettes.net', -20000);
        $this->actingAs($this->admin)->getJson('/api/v1/reports/periode?du=2026-10-09&au=2026-10-10')
            ->assertJsonPath('data.recettes.net', 0);
    }

    /** Phase 3 : « combien ai-je encaissé hier, par qui, comment, et combien sont entrés ? » */
    public function test_rapport_journalier_repond_aux_questions_du_patron(): void
    {
        $this->freeze('2026-10-09 09:00');
        $member = $this->memberWithSubscription();
        $this->sellSubscription($this->member(), overrides: ['mode' => 'orange_money', 'reference_transaction' => 'OM9'])->assertCreated();
        $this->scan($member->qr_token)->assertJsonPath('data.resultat', 'ACCEPTE');

        $this->freeze('2026-10-10 08:00');
        $data = $this->actingAs($this->admin)->getJson('/api/v1/reports/journalier?du=2026-10-09')->assertOk()->json('data');

        $this->assertSame(40000, $data['recettes']['net']);
        $this->assertSame('Awa', $data['par_employe'][0]['libelle']);
        $this->assertEqualsCanonicalizing(['especes', 'orange_money'], array_column($data['par_mode'], 'cle'));
        $this->assertSame(1, $data['frequentation']['total_entrees']);
    }

    /** @return array<string, array{0: string}> */
    public static function rapports(): array
    {
        return array_combine(
            ReportController::TYPES,
            array_map(fn ($t) => [$t], ReportController::TYPES),
        );
    }

    #[DataProvider('rapports')]
    public function test_chaque_rapport_s_exporte_en_json_csv_et_pdf(string $type): void
    {
        $member = $this->memberWithSubscription();
        $this->scan($member->qr_token);

        $this->actingAs($this->admin)->getJson("/api/v1/reports/{$type}?du=2026-01-01")
            ->assertOk()->assertJsonStructure(['data', 'table' => ['titre', 'colonnes', 'lignes']]);

        $csv = $this->actingAs($this->admin)->get("/api/v1/reports/{$type}?du=2026-01-01&format=csv");
        $csv->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv->streamedContent());

        $this->actingAs($this->admin)->get("/api/v1/reports/{$type}?du=2026-01-01&format=pdf")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_rapport_inconnu_404(): void
    {
        $this->actingAs($this->admin)->getJson('/api/v1/reports/inexistant')->assertNotFound();
    }

    public function test_alertes_et_exports_de_relance(): void
    {
        $this->freeze('2026-10-09 09:00');
        $bientot = $this->memberWithSubscription();

        $this->freeze('2026-11-02 09:00'); // fin le 07/11 : dans 5 jours
        $this->actingAs($this->admin)->getJson('/api/v1/alerts')
            ->assertOk()
            ->assertJsonPath('data.expirent_bientot.0.member_id', $bientot->id)
            ->assertJsonPath('data.expirent_bientot.0.jours_restants', 5);

        $this->freeze('2026-11-20 09:00');
        $this->actingAs($this->admin)->getJson('/api/v1/alerts')
            ->assertJsonPath('data.expires_recemment.0.member_id', $bientot->id);

        $this->actingAs($this->admin)->get('/api/v1/alerts/expires-recemment/export')->assertOk();
        $this->actingAs($this->admin)->get('/api/v1/alerts/expirent-bientot/export?format=pdf')
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_taux_de_refus_anormal_signale(): void
    {
        $member = $this->memberWithSubscription();
        $this->scan($member->qr_token);
        $autre = User::factory()->scanner()->create();
        for ($i = 0; $i < 9; $i++) {
            $this->scan('M-FAUX'.$i, user: $autre);
        }

        $this->actingAs($this->admin)->getJson('/api/v1/alerts')
            ->assertJsonPath('data.refus_scan.total', 10)
            ->assertJsonPath('data.refus_scan.anormal', true);
    }
}
