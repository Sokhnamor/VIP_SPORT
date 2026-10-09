<?php

namespace Tests;

use App\Models\CashSession;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\User;
use App\Services\CashSessionService;
use App\Support\Settings;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Testing\TestResponse;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $reception;

    protected User $scanner;

    protected Plan $mensuel;

    protected Plan $seance;

    protected function setUp(): void
    {
        parent::setUp();

        Settings::flush();
        // Requête « stateful » (comme la SPA) : Sanctum active la session et les cookies.
        $this->withHeader('Referer', 'http://localhost');
        $this->admin = User::factory()->admin()->create(['nom' => 'Patron', 'identifiant' => 'patron']);
        $this->reception = User::factory()->receptionniste()->create(['nom' => 'Awa', 'identifiant' => 'awa']);
        $this->scanner = User::factory()->scanner()->create(['nom' => 'Porte', 'identifiant' => 'porte']);
        $this->mensuel = Plan::factory()->mensuel()->create();
        $this->seance = Plan::factory()->seance()->create();
    }

    protected function tearDown(): void
    {
        $this->travelBack();
        Carbon::setTestNow();
        CarbonImmutable::setTestNow();

        parent::tearDown();
    }

    /** Fige l'horloge à une date/heure de Dakar (UTC+0). */
    protected function freeze(string $localDateTime): void
    {
        $this->travelTo(CarbonImmutable::parse($localDateTime, 'Africa/Dakar'));
    }

    protected function openSession(?User $user = null, int $fond = 0): CashSession
    {
        return app(CashSessionService::class)->open($user ?? $this->reception, $fond);
    }

    protected function member(array $attributes = []): Member
    {
        return Member::factory()->create($attributes);
    }

    /** Vente d'abonnement via l'API, en tant que $user (réceptionniste par défaut). */
    protected function sellSubscription(Member $member, ?Plan $plan = null, array $overrides = [], ?User $user = null): TestResponse
    {
        $plan ??= $this->mensuel;

        return $this->actingAs($user ?? $this->reception)->postJson('/api/v1/sales/subscription', array_merge([
            'member_id' => $member->id,
            'plan_id' => $plan->id,
            'mode' => 'especes',
            'montant_encaisse' => $plan->prix_fcfa,
        ], $overrides));
    }

    protected function sellTicket(array $overrides = [], ?User $user = null): TestResponse
    {
        return $this->actingAs($user ?? $this->reception)->postJson('/api/v1/sales/ticket', array_merge([
            'plan_id' => $this->seance->id,
            'mode' => 'especes',
            'montant_encaisse' => $this->seance->prix_fcfa,
        ], $overrides));
    }

    /** Membre avec un abonnement mensuel payé (session de caisse ouverte au besoin). */
    protected function memberWithSubscription(?Plan $plan = null): Member
    {
        if (! $this->reception->openCashSession()->exists()) {
            $this->openSession();
        }
        $member = $this->member();
        $this->sellSubscription($member, $plan)->assertCreated();

        return $member->fresh();
    }

    protected function scan(string $code, string $type = 'entree', ?User $user = null): TestResponse
    {
        return $this->actingAs($user ?? $this->scanner)->postJson('/api/v1/scan', ['code' => $code, 'type' => $type]);
    }

    protected function lastPayment(): Payment
    {
        return Payment::query()->latest('id')->firstOrFail();
    }
}
