<?php

namespace App\Services;

use App\Enums\MemberStatus;
use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Support\Dates;

class DashboardService
{
    public function __construct(
        private readonly ReportService $reports,
        private readonly AlertService $alerts,
    ) {}

    public function data(): array
    {
        $today = Dates::todayString();
        [$monthStart] = ReportService::currentMonth();
        [$from30] = ReportService::lastDays(30);

        $activeMembers = Subscription::query()
            ->where('statut', SubscriptionStatus::Actif->value)
            ->whereDate('date_debut', '<=', $today)
            ->whereDate('date_fin', '>=', $today)
            ->whereHas('member', fn ($q) => $q->where('statut', MemberStatus::Actif->value))
            ->distinct()
            ->count('member_id');

        return [
            'date' => $today,
            'recettes_jour' => $this->reports->revenue($today, $today),
            'recettes_mois' => $this->reports->revenue($monthStart, $today),
            'par_mode_jour' => $this->reports->byMode($today, $today),
            'entrees_jour' => $this->reports->entriesCount($today, $today),
            'membres_actifs' => $activeMembers,
            'expirent_bientot' => $this->alerts->expiringSoon()->take(10)->map(fn ($row) => [
                'member_id' => $row['member']->id,
                'nom' => $row['member']->nom_complet,
                'telephone' => $row['member']->telephone,
                'couvert_jusqu_au' => $row['couvert_jusqu_au'],
                'jours_restants' => $row['jours_restants'],
            ])->values(),
            'ecarts_caisse' => $this->alerts->cashDiscrepancies()->take(10)->map(fn ($s) => [
                'id' => $s->id,
                'employe' => $s->user->nom,
                'fermee_at' => Dates::iso($s->fermee_at),
                'ecart' => $s->ecart,
                'motif_ecart' => $s->motif_ecart,
                'commentaire_admin' => $s->commentaire_admin,
            ])->values(),
            'recettes_30j' => $this->reports->dailySeries($from30, $today),
            'frequentation_jour' => $this->reports->attendance($today, $today)['par_heure'],
            'frequentation_30j' => $this->reports->attendance($from30, $today)['par_heure'],
            'alertes' => $this->alerts->summary(),
        ];
    }
}
