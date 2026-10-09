<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use LogicException;
use Tests\TestCase;

/** §11.13 : chaque action sensible apparaît dans le journal avec auteur, date, avant et après. */
class AuditTest extends TestCase
{
    public function test_les_actions_sensibles_sont_journalisees(): void
    {
        $member = $this->memberWithSubscription();
        $payment = $this->lastPayment();
        $subscription = $member->subscriptions()->sole();

        $this->actingAs($this->admin)->putJson("/api/v1/plans/{$this->mensuel->id}", ['prix_fcfa' => 22000])->assertOk();
        $this->actingAs($this->admin)->postJson("/api/v1/subscriptions/{$subscription->id}/suspend", ['motif' => 'Voyage'])->assertOk();
        $this->actingAs($this->admin)->postJson("/api/v1/payments/{$payment->id}/cancel", ['motif' => 'Doublon'])->assertOk();
        $this->actingAs($this->reception)->postJson('/api/v1/access/manual', ['member_id' => $member->id, 'motif' => 'QR illisible'])->assertOk();
        $this->actingAs($this->admin)->putJson('/api/v1/settings', ['une_entree_par_jour' => true])->assertOk();

        $expected = [
            'membre.creation' => null,
            'caisse.ouverture' => $this->reception->id,
            'paiement.creation' => $this->reception->id,
            'formule.modification' => $this->admin->id,
            'abonnement.suspension' => $this->admin->id,
            'paiement.annulation' => $this->admin->id,
            'acces.entree_manuelle' => $this->reception->id,
            'parametres.modification' => $this->admin->id,
        ];

        foreach ($expected as $action => $userId) {
            if ($action === 'membre.creation') {
                continue; // membre créé par la factory dans ce test (voir MemberTest)
            }
            $log = AuditLog::query()->where('action', $action)->first();
            $this->assertNotNull($log, "Action {$action} absente du journal.");
            $this->assertSame($userId, $log->user_id, "Auteur incorrect pour {$action}.");
            $this->assertNotNull($log->created_at);
        }

        $tarif = AuditLog::query()->where('action', 'formule.modification')->sole();
        $this->assertSame(['prix_fcfa' => 20000], $tarif->avant);
        $this->assertSame(['prix_fcfa' => 22000], $tarif->apres);

        $annulation = AuditLog::query()->where('action', 'paiement.annulation')->sole();
        $this->assertSame(20000, $annulation->avant['montant_encaisse']);
        $this->assertSame('Doublon', $annulation->apres['motif']);
    }

    public function test_journal_consultable_et_filtrable_par_l_admin(): void
    {
        $this->memberWithSubscription();

        $this->actingAs($this->admin)->getJson('/api/v1/audit-logs?action=paiement')
            ->assertOk()
            ->assertJsonPath('data.0.action', 'paiement.creation')
            ->assertJsonPath('data.0.utilisateur', 'Awa');
    }

    public function test_le_journal_est_en_lecture_seule(): void
    {
        $this->memberWithSubscription();
        $log = AuditLog::query()->firstOrFail();

        $this->expectException(LogicException::class);
        $log->delete();
    }

    public function test_les_mots_de_passe_ne_sont_jamais_journalises(): void
    {
        $this->actingAs($this->admin)->postJson('/api/v1/users', [
            'nom' => 'Nouveau', 'identifiant' => 'nouveau', 'role' => 'scanner', 'mot_de_passe' => 'Secret-2026-Xy',
        ])->assertCreated();

        $this->assertStringNotContainsString('Secret-2026-Xy', AuditLog::query()->get()->toJson());
    }
}
