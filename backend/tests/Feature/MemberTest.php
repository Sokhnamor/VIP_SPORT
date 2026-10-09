<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Member;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MemberTest extends TestCase
{
    public function test_creation_avec_telephone_normalise(): void
    {
        $this->actingAs($this->reception)->postJson('/api/v1/members', [
            'nom' => 'Ndiaye',
            'prenom' => 'Fatou',
            'telephone' => '00221 77 555 66 77',
        ])->assertCreated()
            ->assertJsonPath('data.telephone', '+221775556677')
            ->assertJsonPath('data.telephone_affiche', '+221 77 555 66 77');
    }

    public function test_telephone_invalide_refuse(): void
    {
        $this->actingAs($this->reception)->postJson('/api/v1/members', [
            'nom' => 'Ndiaye', 'prenom' => 'Fatou', 'telephone' => '0612345678',
        ])->assertStatus(422)->assertJsonValidationErrors('telephone');
    }

    public function test_doublon_detecte_sur_le_telephone(): void
    {
        $existant = $this->member(['telephone' => '+221771112233', 'nom' => 'Sow', 'prenom' => 'Awa']);

        $this->actingAs($this->reception)->postJson('/api/v1/members', [
            'nom' => 'Sow', 'prenom' => 'Awa', 'telephone' => '77 111 22 33',
        ])->assertStatus(409)
            ->assertJsonPath('code', 'TELEPHONE_DOUBLON')
            ->assertJsonPath('context.member_id', $existant->id);
    }

    public function test_recherche_tolerante_aux_accents_casse_et_fautes(): void
    {
        $this->member(['nom' => 'Dièye', 'prenom' => 'Ndèye', 'telephone' => '+221770000001']);
        $this->member(['nom' => 'Diallo', 'prenom' => 'Mamadou', 'telephone' => '+221780000002']);

        $search = fn (string $q) => $this->actingAs($this->reception)->getJson('/api/v1/members?q='.urlencode($q))->json('data.*.nom');

        $this->assertSame(['Dièye'], $search('dieye'));
        $this->assertSame(['Dièye'], $search('NDEYE'));
        $this->assertSame(['Diallo'], $search('Mamadu'));       // faute de frappe
        $this->assertSame(['Diallo'], $search('78 000 00 02'));  // téléphone avec espaces
        $this->assertSame(['Diallo'], $search('780000002'));
    }

    public function test_modification_tracee_avant_apres(): void
    {
        $member = $this->member(['nom' => 'Fall']);

        $this->actingAs($this->reception)->putJson("/api/v1/members/{$member->id}", ['nom' => 'Fall-Diop'])->assertOk();

        $this->assertDatabaseHas('audit_logs', ['action' => 'membre.modification', 'entite_id' => $member->id]);
        $log = AuditLog::query()->where('action', 'membre.modification')->sole();
        $this->assertSame(['nom' => 'Fall'], $log->avant);
        $this->assertSame(['nom' => 'Fall-Diop'], $log->apres);
    }

    public function test_photo_validee_et_stockee_hors_du_dossier_public(): void
    {
        Storage::fake('local');
        $member = $this->member();

        $this->actingAs($this->reception)->post("/api/v1/members/{$member->id}", [
            'photo' => UploadedFile::fake()->create('photo.php', 10, 'application/x-php'),
        ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('photo');

        $this->actingAs($this->reception)->post("/api/v1/members/{$member->id}", [
            'photo' => UploadedFile::fake()->image('photo.jpg'),
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('data.photo_url', fn ($url) => str_contains($url, 'signature='));

        Storage::disk('local')->assertExists($member->fresh()->photo_path);
    }

    public function test_pas_de_suppression_archivage_et_anonymisation_par_l_admin(): void
    {
        $member = $this->memberWithSubscription();

        $this->actingAs($this->admin)->deleteJson("/api/v1/members/{$member->id}")->assertStatus(405);

        $this->actingAs($this->admin)->postJson("/api/v1/members/{$member->id}/archive")->assertOk()->assertJsonPath('data.statut', 'archive');
        $this->actingAs($this->reception)->getJson('/api/v1/members')->assertJsonCount(0, 'data');

        $this->actingAs($this->admin)->postJson("/api/v1/members/{$member->id}/anonymize")->assertOk()->assertJsonPath('data.anonymise', true);

        $member->refresh();
        $this->assertSame('Anonyme', $member->nom);
        $this->assertNull($member->qr_token);
        $this->assertSame(1, $member->payments()->count(), 'L\'historique financier est conservé.');
    }

    public function test_export_des_donnees_d_un_membre_par_l_admin(): void
    {
        $member = $this->memberWithSubscription();

        $this->actingAs($this->admin)->getJson("/api/v1/members/{$member->id}/export")
            ->assertOk()
            ->assertJsonStructure(['membre', 'abonnements', 'paiements', 'entrees']);

        $this->assertDatabaseHas('audit_logs', ['action' => 'membre.export', 'entite_id' => $member->id]);
    }

    public function test_fiche_membre_avec_historique(): void
    {
        $member = $this->memberWithSubscription();
        $this->scan($member->qr_token);

        $this->actingAs($this->reception)->getJson("/api/v1/members/{$member->id}")
            ->assertOk()
            ->assertJsonPath('data.a_un_qr', true)
            ->assertJsonPath('data.abonnement_en_cours.statut', 'actif')
            ->assertJsonCount(1, 'abonnements')
            ->assertJsonCount(1, 'paiements')
            ->assertJsonCount(1, 'entrees');

        $this->assertArrayNotHasKey('qr_token', Member::findOrFail($member->id)->toArray());
    }
}
