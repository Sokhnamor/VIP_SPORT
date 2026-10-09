<?php

namespace Tests\Feature;

use App\Models\Expense;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ExpenseTest extends TestCase
{
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'date_depense' => now()->toDateString(),
            'categorie' => 'electricite',
            'montant' => 45000,
            'description' => 'Facture Senelec',
            'mode' => 'wave',
        ], $overrides);
    }

    public function test_depense_du_receptionniste_en_attente_puis_validee_par_l_admin(): void
    {
        Storage::fake('local');

        $id = $this->actingAs($this->reception)->post('/api/v1/expenses', $this->payload([
            'justificatif' => UploadedFile::fake()->create('facture.pdf', 100, 'application/pdf'),
        ]), ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.statut', 'en_attente')
            ->assertJsonPath('data.a_justificatif', true)
            ->json('data.id');

        // Non comptée dans les bilans tant qu'elle n'est pas validée.
        $this->actingAs($this->admin)->getJson('/api/v1/reports/depenses')->assertJsonPath('data.total', 0);

        $this->actingAs($this->reception)->postJson("/api/v1/expenses/{$id}/validate")->assertStatus(403);
        $this->actingAs($this->admin)->postJson("/api/v1/expenses/{$id}/validate")
            ->assertOk()->assertJsonPath('data.statut', 'validee');

        $this->actingAs($this->admin)->getJson('/api/v1/reports/depenses')->assertJsonPath('data.total', 45000);
        $this->actingAs($this->reception)->get("/api/v1/expenses/{$id}/justificatif")->assertOk();
    }

    public function test_depense_de_l_admin_validee_directement(): void
    {
        $this->actingAs($this->admin)->postJson('/api/v1/expenses', $this->payload())
            ->assertCreated()->assertJsonPath('data.statut', 'validee');
    }

    public function test_rejet_et_annulation_avec_motif_jamais_de_suppression(): void
    {
        $id = $this->actingAs($this->reception)->postJson('/api/v1/expenses', $this->payload())->json('data.id');

        $this->actingAs($this->admin)->postJson("/api/v1/expenses/{$id}/reject", [])->assertStatus(422);
        $this->actingAs($this->admin)->postJson("/api/v1/expenses/{$id}/reject", ['motif' => 'Pas de facture'])
            ->assertOk()->assertJsonPath('data.statut', 'rejetee');
        // Aucune route de suppression : la requête est rejetée.
        $this->actingAs($this->admin)->deleteJson("/api/v1/expenses/{$id}")->assertClientError();

        $this->assertSame(1, Expense::count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'depense.rejetee', 'entite_id' => $id]);
    }

    public function test_depense_payee_en_caisse_exige_une_caisse_ouverte_et_des_especes(): void
    {
        $this->actingAs($this->reception)->postJson('/api/v1/expenses', $this->payload(['mode' => 'especes', 'payee_depuis_caisse' => true]))
            ->assertStatus(422)->assertJsonPath('code', 'CAISSE_NON_OUVERTE');

        $this->openSession();
        $this->actingAs($this->reception)->postJson('/api/v1/expenses', $this->payload(['mode' => 'wave', 'payee_depuis_caisse' => true]))
            ->assertStatus(422)->assertJsonPath('code', 'DEPENSE_CAISSE_NON_ESPECES');
    }

    public function test_justificatif_type_controle(): void
    {
        $this->actingAs($this->reception)->post('/api/v1/expenses', $this->payload([
            'justificatif' => UploadedFile::fake()->create('virus.exe', 10, 'application/x-msdownload'),
        ]), ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('justificatif');
    }
}
