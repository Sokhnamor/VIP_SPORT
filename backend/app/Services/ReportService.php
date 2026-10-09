<?php

namespace App\Services;

use App\Enums\AccessType;
use App\Enums\CashSessionStatus;
use App\Enums\ExpenseStatus;
use App\Enums\ScanResult;
use App\Enums\SubscriptionStatus;
use App\Models\AccessLog;
use App\Models\CashSession;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\PaymentCancellation;
use App\Models\Subscription;
use App\Support\Dates;
use Carbon\CarbonImmutable;
use Carbon\CarbonPeriod;
use Illuminate\Support\Collection;

/**
 * Chiffres de pilotage. Définition unique des recettes, utilisée partout (tableau de bord,
 * rapports, exports) :
 *
 *   recettes nettes = Σ paiements créés dans la période − Σ paiements annulés dans la période
 *
 * (une annulation compte à la date où elle est faite : une période déjà close ne change pas).
 * Les agrégations par jour/heure sont faites en PHP dans le fuseau de la salle, pour rester
 * exactes et portables (MySQL en production, SQLite en tests).
 */
class ReportService
{
    /** @return array{brut: int, annulations: int, net: int, nombre_paiements: int, nombre_annulations: int} */
    public function revenue(string $from, string $to): array
    {
        $payments = $this->payments($from, $to);
        $cancelled = $this->cancellations($from, $to);

        $brut = (int) $payments->sum('montant_encaisse');
        $annulations = (int) $cancelled->sum(fn ($c) => $c->payment->montant_encaisse);

        return [
            'brut' => $brut,
            'annulations' => $annulations,
            'net' => $brut - $annulations,
            'nombre_paiements' => $payments->count(),
            'nombre_annulations' => $cancelled->count(),
        ];
    }

    /** Recettes nettes ventilées selon une clé (mode, employé, formule). */
    public function breakdown(string $from, string $to, callable $key, callable $label): array
    {
        $rows = [];
        foreach ($this->payments($from, $to) as $payment) {
            $k = $key($payment);
            $rows[$k] ??= ['cle' => $k, 'libelle' => $label($payment), 'nombre' => 0, 'brut' => 0, 'annulations' => 0];
            $rows[$k]['nombre']++;
            $rows[$k]['brut'] += $payment->montant_encaisse;
        }
        foreach ($this->cancellations($from, $to) as $cancellation) {
            $payment = $cancellation->payment;
            $k = $key($payment);
            $rows[$k] ??= ['cle' => $k, 'libelle' => $label($payment), 'nombre' => 0, 'brut' => 0, 'annulations' => 0];
            $rows[$k]['annulations'] += $payment->montant_encaisse;
        }

        return collect($rows)
            ->map(fn ($row) => $row + ['net' => $row['brut'] - $row['annulations']])
            ->sortByDesc('net')
            ->values()
            ->all();
    }

    public function byMode(string $from, string $to): array
    {
        return $this->breakdown($from, $to, fn (Payment $p) => $p->mode->value, fn (Payment $p) => $p->mode->label());
    }

    public function byUser(string $from, string $to): array
    {
        return $this->breakdown($from, $to, fn (Payment $p) => (string) $p->user_id, fn (Payment $p) => $p->user->nom);
    }

    public function byPlan(string $from, string $to): array
    {
        return $this->breakdown($from, $to, fn (Payment $p) => (string) $p->plan_id, fn (Payment $p) => $p->plan->nom);
    }

    /** Recettes nettes par jour (pour le graphique 30 jours). */
    public function dailySeries(string $from, string $to): array
    {
        $tz = Dates::timezone();
        $days = [];
        foreach (CarbonPeriod::create($from, $to) as $day) {
            $days[$day->toDateString()] = 0;
        }

        foreach ($this->payments($from, $to) as $payment) {
            $days[$payment->created_at->setTimezone($tz)->toDateString()] += $payment->montant_encaisse;
        }
        foreach ($this->cancellations($from, $to) as $cancellation) {
            $days[$cancellation->created_at->setTimezone($tz)->toDateString()] -= $cancellation->payment->montant_encaisse;
        }

        return collect($days)->map(fn ($net, $date) => ['date' => $date, 'net' => $net])->values()->all();
    }

    /** Fréquentation : entrées acceptées par heure et par jour de la semaine. */
    public function attendance(string $from, string $to): array
    {
        $tz = Dates::timezone();
        $entries = $this->acceptedEntries($from, $to)->get(['id', 'member_id', 'ticket_id', 'scanned_at']);

        $byHour = array_fill(0, 24, 0);
        $byWeekday = array_fill(1, 7, 0);
        foreach ($entries as $entry) {
            $local = $entry->scanned_at->setTimezone($tz);
            $byHour[(int) $local->format('G')]++;
            $byWeekday[(int) $local->format('N')]++;
        }

        $jours = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

        return [
            'total_entrees' => $entries->count(),
            'membres_distincts' => $entries->whereNotNull('member_id')->unique('member_id')->count(),
            'tickets' => $entries->whereNotNull('ticket_id')->count(),
            'par_heure' => collect($byHour)->map(fn ($n, $h) => ['heure' => sprintf('%02dh', $h), 'entrees' => $n])->values()->all(),
            'par_jour' => collect($byWeekday)->map(fn ($n, $d) => ['jour' => $jours[$d], 'entrees' => $n])->values()->all(),
        ];
    }

    public function entriesCount(string $from, string $to): int
    {
        return $this->acceptedEntries($from, $to)->count();
    }

    /**
     * Taux de renouvellement : parmi les abonnements (non annulés) arrivés à échéance dans la
     * période, part des membres qui ont repris un abonnement commençant au plus tard 30 jours après.
     */
    public function renewalRate(string $from, string $to): array
    {
        $ending = Subscription::query()
            ->where('statut', '!=', SubscriptionStatus::Annule->value)
            ->whereDate('date_fin', '>=', $from)
            ->whereDate('date_fin', '<=', $to)
            ->get(['id', 'member_id', 'date_fin']);

        $renewed = $ending->filter(function (Subscription $sub) {
            $fin = $sub->date_fin;

            return Subscription::query()
                ->where('member_id', $sub->member_id)
                ->where('id', '!=', $sub->id)
                ->where('statut', '!=', SubscriptionStatus::Annule->value)
                ->whereDate('date_debut', '>', $fin->subDays(60)->toDateString())
                ->whereDate('date_debut', '<=', $fin->addDays(30)->toDateString())
                ->where('id', '>', $sub->id)
                ->exists();
        })->count();

        $total = $ending->count();

        return [
            'arrives_a_echeance' => $total,
            'renouveles' => $renewed,
            'taux' => $total > 0 ? round($renewed * 100 / $total, 1) : null,
        ];
    }

    public function manualEntries(string $from, string $to): Collection
    {
        [$start, $end] = Dates::rangeBoundsUtc($from, $to);

        return AccessLog::query()
            ->with(['member:id,nom,prenom', 'user:id,nom'])
            ->where('manuel', true)
            ->whereBetween('scanned_at', [$start, $end])
            ->orderByDesc('scanned_at')
            ->get();
    }

    public function cancellationsList(string $from, string $to): Collection
    {
        return $this->cancellations($from, $to)->sortByDesc('created_at')->values();
    }

    public function reductionsList(string $from, string $to): Collection
    {
        return $this->payments($from, $to)->where('reduction', '>', 0)->sortByDesc('created_at')->values();
    }

    /** Dépenses validées de la période, par catégorie. */
    public function expenses(string $from, string $to): array
    {
        $rows = Expense::query()
            ->where('statut', ExpenseStatus::Validee->value)
            ->whereDate('date_depense', '>=', $from)
            ->whereDate('date_depense', '<=', $to)
            ->get(['categorie', 'montant']);

        return [
            'total' => (int) $rows->sum('montant'),
            'par_categorie' => $rows->groupBy(fn ($e) => $e->categorie->value)
                ->map(fn ($group, $cat) => [
                    'categorie' => $cat,
                    'libelle' => $group->first()->categorie->label(),
                    'total' => (int) $group->sum('montant'),
                ])->values()->all(),
        ];
    }

    public function cashSessions(string $from, string $to): Collection
    {
        [$start, $end] = Dates::rangeBoundsUtc($from, $to);

        return CashSession::query()
            ->with('user:id,nom')
            ->whereBetween('ouverte_at', [$start, $end])
            ->orderByDesc('ouverte_at')
            ->get();
    }

    /** Rapport complet d'une période (journalier, mensuel ou libre). */
    public function period(string $from, string $to): array
    {
        $revenue = $this->revenue($from, $to);
        $expenses = $this->expenses($from, $to);
        $sessions = $this->cashSessions($from, $to);

        return [
            'periode' => ['du' => $from, 'au' => $to],
            'recettes' => $revenue,
            'par_mode' => $this->byMode($from, $to),
            'par_employe' => $this->byUser($from, $to),
            'par_formule' => $this->byPlan($from, $to),
            'depenses' => $expenses,
            'resultat' => $revenue['net'] - $expenses['total'],
            'frequentation' => $this->attendance($from, $to),
            'renouvellement' => $this->renewalRate($from, $to),
            'caisse' => [
                'sessions' => $sessions->count(),
                'ecart_total' => (int) $sessions->where('statut', CashSessionStatus::Cloturee)->sum('ecart'),
                'sessions_avec_ecart' => $sessions->filter(fn ($s) => $s->ecart !== null && $s->ecart !== 0)->count(),
            ],
            'entrees_manuelles' => $this->manualEntries($from, $to)->count(),
        ];
    }

    /** @return Collection<int, Payment> */
    public function payments(string $from, string $to): Collection
    {
        [$start, $end] = Dates::rangeBoundsUtc($from, $to);

        return Payment::query()
            ->with(['user:id,nom', 'plan:id,nom', 'member:id,nom,prenom', 'cancellation', 'reductionApprover:id,nom'])
            ->whereBetween('created_at', [$start, $end])
            ->orderBy('created_at')
            ->get();
    }

    /** @return Collection<int, PaymentCancellation> */
    public function cancellations(string $from, string $to): Collection
    {
        [$start, $end] = Dates::rangeBoundsUtc($from, $to);

        return PaymentCancellation::query()
            ->with(['payment.user:id,nom', 'payment.plan:id,nom', 'payment.member:id,nom,prenom', 'user:id,nom'])
            ->whereBetween('created_at', [$start, $end])
            ->get();
    }

    private function acceptedEntries(string $from, string $to)
    {
        [$start, $end] = Dates::rangeBoundsUtc($from, $to);

        return AccessLog::query()
            ->where('type', AccessType::Entree->value)
            ->whereIn('resultat', [ScanResult::Accepte->value, ScanResult::AccepteAlerte->value])
            ->whereBetween('scanned_at', [$start, $end]);
    }

    /** Raccourci : bornes du mois courant (Dakar). */
    public static function currentMonth(): array
    {
        $today = Dates::today();

        return [$today->startOfMonth()->toDateString(), $today->toDateString()];
    }

    public static function lastDays(int $days): array
    {
        $today = Dates::today();

        return [$today->subDays($days - 1)->toDateString(), $today->toDateString()];
    }

    public static function parseDay(?string $day): string
    {
        return $day ? CarbonImmutable::parse($day)->toDateString() : Dates::todayString();
    }
}
