<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Database\Factories\UserFactory;
use Tests\TestCase;

class AuthTest extends TestCase
{
    public function test_connexion_reussie_renvoie_le_role_et_est_journalisee(): void
    {
        $this->postJson('/api/v1/auth/login', ['identifiant' => 'awa', 'mot_de_passe' => UserFactory::PASSWORD])
            ->assertOk()
            ->assertJsonPath('data.role', 'receptionniste');

        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.connexion', 'user_id' => $this->reception->id]);
        $this->assertNotNull($this->reception->fresh()->derniere_connexion);
    }

    public function test_echec_de_connexion_est_journalise(): void
    {
        $this->postJson('/api/v1/auth/login', ['identifiant' => 'awa', 'mot_de_passe' => 'mauvais'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('identifiant');

        $log = AuditLog::query()->where('action', 'auth.echec')->firstOrFail();
        $this->assertSame('identifiants_invalides', $log->apres['raison']);
    }

    public function test_compte_desactive_ne_peut_pas_se_connecter(): void
    {
        $this->reception->update(['actif' => false]);

        $this->postJson('/api/v1/auth/login', ['identifiant' => 'awa', 'mot_de_passe' => UserFactory::PASSWORD])
            ->assertStatus(422);
    }

    public function test_compte_desactive_pendant_la_session_est_deconnecte(): void
    {
        $this->actingAs($this->reception)->getJson('/api/v1/auth/me')->assertOk();
        $this->reception->update(['actif' => false]);

        $this->actingAs($this->reception->fresh())->getJson('/api/v1/members')->assertStatus(401);
    }

    public function test_limitation_des_tentatives_de_connexion(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', ['identifiant' => 'awa', 'mot_de_passe' => 'faux'])->assertStatus(422);
        }

        $this->postJson('/api/v1/auth/login', ['identifiant' => 'awa', 'mot_de_passe' => 'faux'])->assertStatus(429);
    }

    public function test_mot_de_passe_initial_doit_etre_change_avant_toute_action(): void
    {
        $this->admin->update(['doit_changer_mdp' => true]);

        $this->actingAs($this->admin)->getJson('/api/v1/dashboard')
            ->assertStatus(403)
            ->assertJsonPath('code', 'MOT_DE_PASSE_A_CHANGER');
        $this->actingAs($this->admin)->getJson('/api/v1/auth/me')->assertOk();

        $this->actingAs($this->admin)->postJson('/api/v1/auth/password', [
            'mot_de_passe_actuel' => UserFactory::PASSWORD,
            'nouveau_mot_de_passe' => 'NouveauPatron2026',
            'nouveau_mot_de_passe_confirmation' => 'NouveauPatron2026',
        ])->assertOk();

        $this->actingAs($this->admin->fresh())->getJson('/api/v1/dashboard')->assertOk();
    }

    public function test_mot_de_passe_faible_refuse(): void
    {
        $this->actingAs($this->admin)->postJson('/api/v1/auth/password', [
            'mot_de_passe_actuel' => UserFactory::PASSWORD,
            'nouveau_mot_de_passe' => 'abc123',
            'nouveau_mot_de_passe_confirmation' => 'abc123',
        ])->assertStatus(422)->assertJsonValidationErrors('nouveau_mot_de_passe');
    }

    public function test_deconnexion_automatique_apres_30_minutes_d_inactivite(): void
    {
        $this->actingAs($this->reception)
            ->withSession(['derniere_activite' => time() - 31 * 60])
            ->getJson('/api/v1/members')
            ->assertStatus(401)
            ->assertJsonPath('code', 'SESSION_EXPIREE');
    }

    public function test_le_scanner_a_une_session_longue(): void
    {
        $this->actingAs($this->scanner)
            ->withSession(['derniere_activite' => time() - 3 * 3600])
            ->getJson('/api/v1/scan/stats')
            ->assertOk();
    }

    public function test_non_authentifie_recoit_401(): void
    {
        $this->getJson('/api/v1/members')->assertStatus(401)->assertJsonPath('code', 'NON_AUTHENTIFIE');
    }

    public function test_un_admin_ne_peut_pas_se_retirer_ses_droits(): void
    {
        $this->actingAs($this->admin)->putJson("/api/v1/users/{$this->admin->id}", ['role' => 'receptionniste'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'ADMIN_SOI_MEME');
    }

    public function test_creation_d_un_compte_employe_avec_mot_de_passe_provisoire(): void
    {
        $this->actingAs($this->admin)->postJson('/api/v1/users', [
            'nom' => 'Modou Fall',
            'identifiant' => 'modou',
            'role' => 'receptionniste',
            'mot_de_passe' => 'Provisoire2026',
        ])->assertCreated()->assertJsonPath('data.doit_changer_mdp', true);

        $this->assertTrue(User::query()->where('identifiant', 'modou')->firstOrFail()->doit_changer_mdp);
        $this->assertDatabaseHas('audit_logs', ['action' => 'utilisateur.creation']);
    }
}
