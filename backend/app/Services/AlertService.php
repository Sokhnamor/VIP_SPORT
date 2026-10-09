<?php

namespace App\Services;

use App\Enums\AccessType;
use App\Enums\ExpenseStatus;
use App\Enums\MemberStatus;
use App\Enums\ScanResult;
use App\Enums\SubscriptionStatus;
use App\Models\AccessLog;
use App\Models\CashSession;
use App\Models\Expense;
use App\Models\Member;
use App\Models\Subscription;
use App\Support\Dates;
use App\Support\Settings;
use Illuminate\Support\Collection;

/** Alertes de pilotage (cahier des charges §4.9). */
class AlertService
{
    /** Taux de refus au-delà duquel le scan est jugé anormal (sur au moins 10 scans). */
    public const REFUSAL_RATE_THRESHOLD = 30.0;

    /** Membres dont la couverture se termine dans le seuil configuré (7 jours par défaut). */
    public function expiringSoon(?int $days = null): Collection
    {
        $days ??= (int) Settings::get('seuil_alerte_expiration');
        $today = Dates::today();
        $limit = $today->addDays($days)->toDateString();

        return $this->coverageByMember()
            ->filter(fn ($row) => $row['couvert_jusqu_au'] >= $today->toDateString() && $row['couvert_jusqu_au'] <= $limit)
            ->sortBy('couvert_jusqu_au')
            ->values();
    }

    /** Membres expirés depuis moins de 30 jours, sans renouvellement (pour relance). */
    public function recentlyExpired(int $days = 30): Collection
    {
        $today = Dates::today();
        $since = $today->subDays($days)->toDateString();

        return $this->coverageByMember()
            ->filter(fn ($row) => $row['couvert_jusqu_au'] < $today->toDateString() && $row['couvert_jusqu_au'] >= $since)
            ->sortByDesc('couvert_jusqu_au')
            ->values();
    }

    /** Sessions ouvertes depuis un jour précédent : oubli de clôture. */
    public function unclosedSessions(): Collection
    {
        return CashSession::query()
            ->with('user:id,nom')
            ->whereNotNull('verrou_ouverte')
            ->where('ouverte_at', '<', Dates::today()->utc())
            ->orderBy('ouverte_at')
            ->get();
    }

    /** Clôtures avec écart non nul sur les 30 derniers jours. */
    public function cashDiscrepancies(int $days = 30): Collection
    {
        return CashSession::query()
            ->with('user:id,nom')
            ->whereNotNull('ecart')
            ->where('ecart', '!=', 0)
            ->where('fermee_at', '>=', Dates::today()->subDays($days)->utc())
            ->orderByDesc('fermee_at')
            ->get();
    }

    /** @return array{total: int, refus: int, taux: ?float, anormal: bool} */
    public function refusalRateToday(): array
    {
        [$start, $end] = Dates::dayBoundsUtc(Dates::todayString());

        $logs = AccessLog::query()
            ->where('type', AccessType::Entree->value)
            ->where('manuel', false)
            ->whereBetween('scanned_at', [$start, $end])
            ->where('resultat', '!=', ScanResult::DejaScanne->value)
            ->get(['resultat']);

        $total = $logs->count();
        $refus = $logs->reject(fn ($l) => $l->resultat->isAccepted())->count();
        $taux = $total > 0 ? round($refus * 100 / $total, 1) : null;

        return [
            'total' => $total,
            'refus' => $refus,
            'taux' => $taux,
            'anormal' => $total >= 10 && $taux !== null && $taux >= self::REFUSAL_RATE_THRESHOLD,
        ];
    }

    public function recentManualEntries(int $days = 7): Collection
    {
        return AccessLog::query()
            ->with(['member:id,nom,prenom', 'user:id,nom'])
            ->where('manuel', true)
            ->where('scanned_at', '>=', Dates::today()->subDays($days - 1)->utc())
            ->orderByDesc('scanned_at')
            ->get();
    }

    public function pendingExpenses(): int
    {
        return Expense::query()->where('statut', ExpenseStatus::EnAttente->value)->count();
    }

    public function summary(): array
    {
        return [
            'expirent_bientot' => $this->expiringSoon()->count(),
            'expires_recemment' => $this->recentlyExpired()->count(),
            'caisses_non_cloturees' => $this->unclosedSessions()->count(),
            'ecarts_caisse' => $this->cashDiscrepancies()->count(),
            'refus_scan' => $this->refusalRateToday(),
            'entrees_manuelles_7j' => $this->recentManualEntries()->count(),
            'depenses_en_attente' => $this->pendingExpenses(),
        ];
    }

    /**
     * Date de fin de couverture de chaque membre actif (dernier abonnement actif, enchaînements compris).
     *
     * @return Collection<int, array{member: Member, couvert_jusqu_au: string, jours_restants: int<0, max>}>
     */
    private function coverageByMember(): Collection
    {
        $rows = Subscription::query()
            ->where('statut', SubscriptionStatus::Actif->value)
            ->selectRaw('member_id, MAX(date_fin) as fin')
            ->groupBy('member_id')
            ->pluck('fin', 'member_id');

        $members = Member::query()
            ->whereIn('id', $rows->keys())
            ->where('statut', MemberStatus::Actif->value)
            ->get(['id', 'nom', 'prenom', 'telephone']);

        $today = Dates::todayString();

        return $members->map(fn (Member $member) => [
            'member' => $member,
            'couvert_jusqu_au' => substr((string) $rows[$member->id], 0, 10),
            'jours_restants' => max(0, Subscription::daysUntil(substr((string) $rows[$member->id], 0, 10), $today) - 1),
        ]);
    }
}
