<?php

namespace Tests\Feature;

use App\Models\AccessLog;
use App\Models\Member;
use App\Models\Presence;
use App\Models\Ticket;
use App\Models\User;
use App\Support\Settings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Contrôle d'accès : tous les cas du tableau §4.5 et scénarios §11.5 à §11.9. */
class ScanTest extends TestCase
{
    /** §11.5 : membre valide → vert, entrée enregistrée, photo affichée ; re-scan < 2 min → jaune, sans doublon. */
    public function test_membre_valide_accepte_puis_deja_scanne(): void
    {
        Storage::fake('local');
        $this->freeze('2026-10-09 08:00');
        $member = $this->memberWithSubscription();
        $this->actingAs($this->reception)->post("/api/v1/members/{$member->id}", [
            'photo' => UploadedFile::fake()->image('photo.jpg'),
        ])->assertOk();

        $this->scan($member->qr_token)
            ->assertOk()
            ->assertJsonPath('data.resultat', 'ACCEPTE')
            ->assertJsonPath('data.couleur', 'vert')
            ->assertJsonPath('data.membre.nom_complet', $member->nom_complet)
            ->assertJsonPath('data.date_fin', '2026-11-07')
            ->assertJsonPath('data.jours_restants', 29)
            ->assertJsonPath('data.membre.photo_url', fn ($url) => is_string($url) && str_contains($url, 'signature='));

        $this->assertSame(1, Presence::count());

        $this->travel(90)->seconds();
        $this->scan($member->qr_token)
            ->assertOk()
            ->assertJsonPath('data.resultat', 'DEJA_SCANNE')
            ->assertJsonPath('data.couleur', 'jaune');

        $this->assertSame(1, Presence::count(), 'Pas de doublon de présence.');
        $this->assertSame(2, AccessLog::count(), 'Le re-scan est quand même journalisé.');

        // Après 2 minutes : nouvelle entrée acceptée (entrées multiples par défaut).
        $this->travel(3)->minutes();
        $this->scan($member->qr_token)->assertJsonPath('data.resultat', 'ACCEPTE');
        $this->assertSame(2, Presence::count());
    }

    public function test_la_photo_du_scan_est_accessible_via_l_url_signee_uniquement(): void
    {
        Storage::fake('local');
        $member = $this->memberWithSubscription();
        $this->actingAs($this->reception)->post("/api/v1/members/{$member->id}", [
            'photo' => UploadedFile::fake()->image('photo.jpg'),
        ])->assertOk();

        $url = $this->scan($member->qr_token)->json('data.membre.photo_url');

        $this->actingAs($this->scanner)->get($url)->assertOk();
        $this->actingAs($this->scanner)->get("/api/v1/members/{$member->id}/photo")->assertStatus(403);
    }

    public function test_alerte_orange_si_expiration_dans_3_jours_ou_moins(): void
    {
        $this->freeze('2026-10-09 08:00');
        $member = $this->memberWithSubscription();

        $this->freeze('2026-11-03 08:00'); // fin le 07/11 : 4 jours restants → vert
        $this->scan($member->qr_token)->assertJsonPath('data.resultat', 'ACCEPTE');

        $this->freeze('2026-11-04 08:00'); // 3 jours restants → orange
        $this->scan($member->qr_token)
            ->assertJsonPath('data.resultat', 'ACCEPTE_ALERTE')
            ->assertJsonPath('data.couleur', 'orange')
            ->assertJsonPath('data.jours_restants', 3);
    }

    public function test_renouvellement_anticipe_evite_l_alerte(): void
    {
        $this->freeze('2026-10-09 08:00');
        $member = $this->memberWithSubscription();
        $this->freeze('2026-11-05 08:00');
        $this->sellSubscription($member)->assertCreated();

        $this->scan($member->qr_token)
            ->assertJsonPath('data.resultat', 'ACCEPTE')
            ->assertJsonPath('data.date_fin', '2026-12-07');
    }

    /** §11.6 : expiré → rouge avec la date, refus journalisé. */
    public function test_abonnement_expire_refuse_avec_la_date(): void
    {
        $this->freeze('2026-10-09 08:00');
        $member = $this->memberWithSubscription();

        $this->freeze('2026-11-08 08:00');
        $this->scan($member->qr_token)
            ->assertOk()
            ->assertJsonPath('data.resultat', 'REFUSE_EXPIRE')
            ->assertJsonPath('data.couleur', 'rouge')
            ->assertJsonPath('data.message', 'Abonnement expiré le 07/11/2026');

        $this->assertDatabaseHas('access_logs', ['member_id' => $member->id, 'resultat' => 'REFUSE_EXPIRE']);
        $this->assertSame(0, Presence::count());
    }

    public function test_membre_sans_abonnement_refuse(): void
    {
        $this->openSession();
        $member = $this->memberWithSubscription();
        $sansAbonnement = $this->member();

        // Un membre jamais payé n'a pas de QR : le seul moyen est l'entrée manuelle, refusée.
        $this->assertNull($sansAbonnement->qr_token);
        $this->actingAs($this->reception)->postJson('/api/v1/access/manual', ['member_id' => $sansAbonnement->id, 'motif' => 'Test'])
            ->assertJsonPath('data.resultat', 'REFUSE_EXPIRE')
            ->assertJsonPath('data.message', 'Aucun abonnement payé');

        $this->assertSame(0, Presence::query()->where('member_id', $sansAbonnement->id)->count());
        $this->assertNotNull($member->qr_token);
    }

    /** §11.6 : suspendu → rouge, refus journalisé ; réactivation → accepté. */
    public function test_abonnement_suspendu_refuse_puis_reactive(): void
    {
        $member = $this->memberWithSubscription();
        $subscription = $member->subscriptions()->sole();

        $this->actingAs($this->reception)->postJson("/api/v1/subscriptions/{$subscription->id}/suspend", ['motif' => 'Blessure'])
            ->assertStatus(403);
        $this->actingAs($this->admin)->postJson("/api/v1/subscriptions/{$subscription->id}/suspend", ['motif' => 'Blessure'])
            ->assertOk()->assertJsonPath('data.statut', 'suspendu');

        $this->scan($member->qr_token)
            ->assertJsonPath('data.resultat', 'REFUSE_SUSPENDU')
            ->assertJsonPath('data.couleur', 'rouge');
        $this->assertDatabaseHas('access_logs', ['member_id' => $member->id, 'resultat' => 'REFUSE_SUSPENDU']);

        $nouvelleFin = $subscription->date_fin->addDays(10)->toDateString();
        $this->actingAs($this->admin)->postJson("/api/v1/subscriptions/{$subscription->id}/resume", [
            'date_fin' => $nouvelleFin,
            'motif' => 'Prolongation de 10 jours (blessure)',
        ])->assertOk()->assertJsonPath('data.statut', 'actif')->assertJsonPath('data.date_fin', $nouvelleFin);

        $this->scan($member->qr_token)->assertJsonPath('data.resultat', 'ACCEPTE');
        $this->assertDatabaseHas('audit_logs', ['action' => 'abonnement.reactivation', 'entite_id' => $subscription->id]);
    }

    /** §11.7 : après annulation du paiement par l'admin, le QR est refusé immédiatement. */
    public function test_paiement_annule_qr_refuse_immediatement(): void
    {
        $member = $this->memberWithSubscription();
        $this->scan($member->qr_token)->assertJsonPath('data.resultat', 'ACCEPTE');

        $this->actingAs($this->admin)->postJson("/api/v1/payments/{$this->lastPayment()->id}/cancel", ['motif' => 'Faux paiement'])
            ->assertOk();

        $this->travel(3)->minutes();
        $this->scan($member->qr_token)
            ->assertJsonPath('data.resultat', 'REFUSE_ANNULE')
            ->assertJsonPath('data.couleur', 'rouge');
    }

    /** §11.8 : ticket accepté une fois, refusé la seconde, refusé le lendemain. */
    public function test_ticket_usage_unique_et_valable_le_jour_meme(): void
    {
        $this->freeze('2026-10-09 10:00');
        $this->openSession();
        $this->sellTicket()->assertCreated();
        $this->sellTicket()->assertCreated();
        [$ticket, $autre] = Ticket::orderBy('id')->get()->all();

        $this->scan($ticket->qr_token)
            ->assertJsonPath('data.resultat', 'ACCEPTE')
            ->assertJsonPath('data.ticket.numero', $ticket->numero);
        $this->assertSame('utilise', $ticket->fresh()->statut->value);

        $this->scan($ticket->qr_token)
            ->assertJsonPath('data.resultat', 'TICKET_UTILISE')
            ->assertJsonPath('data.couleur', 'rouge');

        $this->freeze('2026-10-10 09:00');
        $this->scan($autre->qr_token)
            ->assertJsonPath('data.resultat', 'TICKET_EXPIRE')
            ->assertJsonPath('data.couleur', 'rouge');

        $this->assertSame(1, Presence::count());
        $this->assertSame(3, AccessLog::count());
    }

    public function test_ticket_valide_jusqu_a_minuit_heure_de_dakar(): void
    {
        $this->freeze('2026-10-09 10:00');
        $this->openSession();
        $this->sellTicket()->assertCreated();
        $ticket = Ticket::sole();

        $this->freeze('2026-10-09 23:59');
        $this->scan($ticket->qr_token)->assertJsonPath('data.resultat', 'ACCEPTE');
    }

    public function test_ticket_saisie_manuelle_du_numero_court(): void
    {
        $this->openSession();
        $this->sellTicket()->assertCreated();
        $ticket = Ticket::sole();

        $this->scan(strtolower($ticket->numero))->assertJsonPath('data.resultat', 'ACCEPTE');
    }

    public function test_ticket_annule_refuse(): void
    {
        $this->openSession();
        $this->sellTicket()->assertCreated();
        $this->actingAs($this->admin)->postJson("/api/v1/payments/{$this->lastPayment()->id}/cancel", ['motif' => 'Erreur'])->assertOk();

        $this->scan(Ticket::sole()->qr_token)->assertJsonPath('data.resultat', 'REFUSE_ANNULE');
    }

    /** §11.9 : jeton inconnu refusé ; 30 essais en une minute → limitation de débit. */
    public function test_jeton_inconnu_refuse_et_rate_limiting(): void
    {
        $this->scan('M-JETONINVENTE')
            ->assertOk()
            ->assertJsonPath('data.resultat', 'REFUSE_INCONNU');
        $this->scan('nimporte quoi')->assertJsonPath('data.resultat', 'REFUSE_INCONNU');
        $this->assertDatabaseHas('access_logs', ['resultat' => 'REFUSE_INCONNU', 'token_scanne' => 'M-JETONINVENTE']);

        $statuses = [];
        for ($i = 0; $i < 28; $i++) {
            $statuses[] = $this->scan('M-ESSAI'.$i)->status();
        }

        $this->assertContains(429, $statuses, 'Le débit doit être limité avant 30 essais.');
        $this->assertSame(429, $this->scan('M-ESSAI-FINAL')->status());
    }

    public function test_un_membre_valide_n_est_pas_bloque_par_les_essais_d_un_autre_poste(): void
    {
        $member = $this->memberWithSubscription();
        $autrePoste = User::factory()->scanner()->create();

        for ($i = 0; $i < 12; $i++) {
            $this->scan('M-ESSAI'.$i, user: $autrePoste);
        }

        $this->scan($member->qr_token)->assertJsonPath('data.resultat', 'ACCEPTE');
    }

    public function test_qr_regenere_l_ancien_est_refuse(): void
    {
        $member = $this->memberWithSubscription();
        $ancien = $member->qr_token;

        $this->actingAs($this->admin)->postJson("/api/v1/members/{$member->id}/regenerate-qr")->assertOk();
        $nouveau = $member->fresh()->qr_token;

        $this->assertNotSame($ancien, $nouveau);
        $this->scan($ancien)->assertJsonPath('data.resultat', 'REFUSE_INCONNU');
        $this->scan($nouveau)->assertJsonPath('data.resultat', 'ACCEPTE');
    }

    public function test_membre_archive_refuse(): void
    {
        $member = $this->memberWithSubscription();
        $this->actingAs($this->admin)->postJson("/api/v1/members/{$member->id}/archive")->assertOk();

        $this->scan($member->qr_token)->assertJsonPath('data.resultat', 'REFUSE_INCONNU');
    }

    public function test_option_une_entree_par_jour(): void
    {
        Settings::put(['une_entree_par_jour' => true]);
        $this->freeze('2026-10-09 08:00');
        $member = $this->memberWithSubscription();

        $this->scan($member->qr_token)->assertJsonPath('data.resultat', 'ACCEPTE');
        $this->travel(3)->hours();
        $this->scan($member->qr_token)->assertJsonPath('data.resultat', 'REFUSE_QUOTA_JOUR');

        $this->freeze('2026-10-10 08:00');
        $this->scan($member->qr_token)->assertJsonPath('data.resultat', 'ACCEPTE');
    }

    public function test_mode_sortie(): void
    {
        $member = $this->memberWithSubscription();

        $this->scan($member->qr_token, 'sortie')->assertStatus(422)->assertJsonPath('code', 'SORTIE_DESACTIVEE');

        Settings::put(['mode_sortie' => true]);
        $this->scan($member->qr_token)->assertJsonPath('data.resultat', 'ACCEPTE');
        $this->travel(90)->minutes();
        $this->scan($member->qr_token, 'sortie')
            ->assertJsonPath('data.resultat', 'ACCEPTE')
            ->assertJsonPath('data.type', 'sortie');

        $this->assertNotNull(Presence::sole()->sortie_at);
    }

    public function test_cloture_automatique_des_presences_a_la_fermeture(): void
    {
        Settings::put(['heure_fermeture' => '22:00']);
        $this->freeze('2026-10-09 18:00');
        $member = $this->memberWithSubscription();
        $this->scan($member->qr_token)->assertJsonPath('data.resultat', 'ACCEPTE');

        $this->artisan('gym:cloturer-presences')->assertSuccessful();
        $this->assertNull(Presence::sole()->sortie_at, 'Avant la fermeture : rien n\'est clôturé.');

        $this->freeze('2026-10-09 22:05');
        $this->artisan('gym:cloturer-presences')->assertSuccessful();
        $this->assertTrue(Presence::sole()->cloture_auto);
    }

    public function test_entree_manuelle_avec_motif_obligatoire_et_tracee(): void
    {
        $member = $this->memberWithSubscription();

        $this->actingAs($this->reception)->postJson('/api/v1/access/manual', ['member_id' => $member->id])
            ->assertStatus(422)->assertJsonValidationErrors('motif');

        $this->actingAs($this->reception)->postJson('/api/v1/access/manual', [
            'member_id' => $member->id,
            'motif' => 'QR illisible (écran cassé)',
        ])->assertOk()->assertJsonPath('data.resultat', 'ACCEPTE');

        $this->assertDatabaseHas('access_logs', ['member_id' => $member->id, 'manuel' => true, 'motif_manuel' => 'QR illisible (écran cassé)']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'acces.entree_manuelle', 'entite_id' => $member->id]);

        $this->actingAs($this->admin)->getJson('/api/v1/reports/entrees-manuelles')
            ->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_le_scanner_ne_peut_pas_faire_d_entree_manuelle(): void
    {
        $member = $this->memberWithSubscription();

        $this->actingAs($this->scanner)->postJson('/api/v1/access/manual', ['member_id' => $member->id, 'motif' => 'x x x'])
            ->assertStatus(403);
    }

    public function test_le_qr_ne_contient_aucune_donnee_personnelle(): void
    {
        $member = $this->memberWithSubscription();

        $this->assertMatchesRegularExpression('/^M-[A-Z2-7]{32}$/', $member->qr_token);
        $this->assertStringNotContainsString(substr($member->telephone, 4), $member->qr_token);
        $this->assertNull(Member::query()->find($member->id)->toArray()['qr_token'] ?? null, 'Jamais exposé dans les réponses.');
    }

    public function test_compteur_d_entrees_du_jour_au_poste_de_scan(): void
    {
        $member = $this->memberWithSubscription();
        $this->scan($member->qr_token);

        $this->actingAs($this->scanner)->getJson('/api/v1/scan/stats')
            ->assertOk()
            ->assertJsonPath('data.entrees_jour', 1)
            ->assertJsonPath('data.mode_sortie', false);
    }
}
