<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\PeriodRequest;
use App\Models\AccessLog;
use App\Models\CashSession;
use App\Models\Payment;
use App\Models\PaymentCancellation;
use App\Services\AuditLogger;
use App\Services\PdfService;
use App\Services\ReportService;
use App\Support\Dates;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Rapports (admin). Chaque rapport produit un tableau (titre, colonnes, lignes) exportable
 * tel quel en CSV ou PDF, plus les données brutes en JSON pour l'écran.
 */
class ReportController extends Controller
{
    public const TYPES = [
        'periode', 'journalier', 'mensuel', 'paiements', 'modes', 'employes', 'formules', 'frequentation',
        'renouvellement', 'entrees-manuelles', 'annulations', 'reductions', 'depenses', 'caisse',
    ];

    public function __construct(private readonly ReportService $reports) {}

    public function show(PeriodRequest $request, string $type, PdfService $pdf, AuditLogger $audit): Response|JsonResponse
    {
        abort_unless(in_array($type, self::TYPES, true), 404);

        [$from, $to] = $request->period();
        if ($type === 'mensuel') {
            $month = CarbonImmutable::parse($from);
            [$from, $to] = [$month->startOfMonth()->toDateString(), min($month->endOfMonth()->toDateString(), Dates::todayString())];
        }
        if ($type === 'journalier') {
            $to = $from;
        }

        [$data, $table] = $this->build($type, $from, $to);
        $table['titre'] .= ' — '.$this->periodLabel($from, $to);

        $format = $request->exportFormat();
        if ($format !== 'json') {
            $audit->log('rapport.export', 'Rapport', null, ['type' => $type, 'format' => $format, 'du' => $from, 'au' => $to]);
        }

        return match ($format) {
            'csv' => $this->csv($table, "rapport-{$type}-{$from}_{$to}.csv"),
            'pdf' => $pdf->table($table, "rapport-{$type}-{$from}_{$to}.pdf"),
            default => response()->json(['data' => $data, 'table' => $table, 'du' => $from, 'au' => $to]),
        };
    }

    /** @return array{0: mixed, 1: array{titre: string, colonnes: list<string>, lignes: list<list<mixed>>, totaux?: list<mixed>}} */
    private function build(string $type, string $from, string $to): array
    {
        $r = $this->reports;

        return match ($type) {
            'periode', 'journalier', 'mensuel' => $this->summaryTable($r->period($from, $to), $type),
            'paiements' => $this->paymentsTable($r->payments($from, $to)),
            'modes' => $this->breakdownTable('Recettes par mode de paiement', 'Mode', $r->byMode($from, $to)),
            'employes' => $this->breakdownTable('Recettes par employé', 'Employé', $r->byUser($from, $to)),
            'formules' => $this->breakdownTable('Recettes par formule', 'Formule', $r->byPlan($from, $to)),
            'frequentation' => $this->attendanceTable($r->attendance($from, $to)),
            'renouvellement' => $this->renewalTable($r->renewalRate($from, $to)),
            'entrees-manuelles' => $this->manualTable($r->manualEntries($from, $to)),
            'annulations' => $this->cancellationsTable($r->cancellationsList($from, $to)),
            'reductions' => $this->reductionsTable($r->reductionsList($from, $to)),
            'depenses' => $this->expensesTable($r->expenses($from, $to)),
            'caisse' => $this->cashTable($r->cashSessions($from, $to)),
            default => abort(404),
        };
    }

    private function summaryTable(array $data, string $type): array
    {
        $titles = ['periode' => 'Synthèse', 'journalier' => 'Rapport journalier', 'mensuel' => 'Rapport mensuel'];
        $rev = $data['recettes'];
        $lignes = [
            ['Encaissements (brut)', Money::fcfa($rev['brut']), $rev['nombre_paiements'].' paiement(s)'],
            ['Annulations', Money::fcfa($rev['annulations']), $rev['nombre_annulations'].' annulation(s)'],
            ['Recettes nettes', Money::fcfa($rev['net']), ''],
        ];
        foreach ($data['par_mode'] as $row) {
            $lignes[] = ['  dont '.$row['libelle'], Money::fcfa($row['net']), $row['nombre'].' paiement(s)'];
        }
        foreach ($data['par_employe'] as $row) {
            $lignes[] = ['  encaissé par '.$row['libelle'], Money::fcfa($row['net']), $row['nombre'].' paiement(s)'];
        }
        $lignes[] = ['Dépenses validées', Money::fcfa($data['depenses']['total']), ''];
        $lignes[] = ['Résultat (recettes − dépenses)', Money::fcfa($data['resultat']), ''];
        $lignes[] = ['Entrées', (string) $data['frequentation']['total_entrees'], $data['frequentation']['membres_distincts'].' membre(s) distinct(s), '.$data['frequentation']['tickets'].' ticket(s)'];
        $lignes[] = ['Entrées manuelles', (string) $data['entrees_manuelles'], ''];
        $lignes[] = ['Sessions de caisse', (string) $data['caisse']['sessions'], $data['caisse']['sessions_avec_ecart'].' avec écart, total '.Money::fcfa($data['caisse']['ecart_total'])];

        return [$data, ['titre' => $titles[$type], 'colonnes' => ['Indicateur', 'Valeur', 'Détail'], 'lignes' => $lignes]];
    }

    private function paymentsTable($payments): array
    {
        $lignes = $payments->map(fn (Payment $p) => [
            $p->numero_recu,
            Dates::displayDateTime($p->created_at),
            $p->member->nom_complet ?? 'Ticket séance',
            $p->plan->nom,
            $p->montant_du,
            $p->reduction,
            $p->montant_encaisse,
            $p->mode->label(),
            $p->reference_transaction,
            $p->user->nom,
            $p->cancellation ? 'ANNULÉ' : '',
        ])->all();

        return [$lignes, [
            'titre' => 'Paiements',
            'colonnes' => ['Reçu', 'Date', 'Membre', 'Formule', 'Dû', 'Réduction', 'Encaissé', 'Mode', 'Référence', 'Encaisseur', 'Statut'],
            'lignes' => $lignes,
            'totaux' => ['Total', '', '', '', '', (int) $payments->sum('reduction'), (int) $payments->sum('montant_encaisse'), '', '', '', ''],
        ]];
    }

    private function breakdownTable(string $title, string $label, array $rows): array
    {
        return [$rows, [
            'titre' => $title,
            'colonnes' => [$label, 'Paiements', 'Brut (FCFA)', 'Annulations (FCFA)', 'Net (FCFA)'],
            'lignes' => array_map(fn ($r) => [$r['libelle'], $r['nombre'], $r['brut'], $r['annulations'], $r['net']], $rows),
            'totaux' => ['Total', array_sum(array_column($rows, 'nombre')), array_sum(array_column($rows, 'brut')), array_sum(array_column($rows, 'annulations')), array_sum(array_column($rows, 'net'))],
        ]];
    }

    private function attendanceTable(array $data): array
    {
        $lignes = [];
        foreach ($data['par_heure'] as $h) {
            $lignes[] = ['Heure '.$h['heure'], $h['entrees']];
        }
        foreach ($data['par_jour'] as $d) {
            $lignes[] = [$d['jour'], $d['entrees']];
        }

        return [$data, [
            'titre' => 'Fréquentation',
            'colonnes' => ['Créneau', 'Entrées'],
            'lignes' => $lignes,
            'totaux' => ['Total entrées', $data['total_entrees']],
        ]];
    }

    private function renewalTable(array $data): array
    {
        return [$data, [
            'titre' => 'Taux de renouvellement',
            'colonnes' => ['Abonnements arrivés à échéance', 'Renouvelés (≤ 30 j)', 'Taux'],
            'lignes' => [[$data['arrives_a_echeance'], $data['renouveles'], $data['taux'] === null ? '—' : $data['taux'].' %']],
        ]];
    }

    private function manualTable($logs): array
    {
        $lignes = $logs->map(fn (AccessLog $l) => [
            Dates::displayDateTime($l->scanned_at),
            $l->member?->nom_complet,
            $l->resultat->value,
            $l->motif_manuel,
            $l->user->nom,
        ])->all();

        return [$lignes, ['titre' => 'Entrées manuelles', 'colonnes' => ['Date', 'Membre', 'Résultat', 'Motif', 'Employé'], 'lignes' => $lignes]];
    }

    private function cancellationsTable($cancellations): array
    {
        $lignes = $cancellations->map(fn (PaymentCancellation $c) => [
            Dates::displayDateTime($c->created_at),
            $c->payment->numero_recu,
            Dates::displayDateTime($c->payment->created_at),
            $c->payment->member->nom_complet ?? 'Ticket séance',
            $c->payment->montant_encaisse,
            $c->payment->user->nom,
            $c->user->nom,
            $c->motif,
        ])->all();

        return [$lignes, [
            'titre' => 'Annulations',
            'colonnes' => ['Annulé le', 'Reçu', 'Payé le', 'Membre', 'Montant', 'Encaisseur', 'Annulé par', 'Motif'],
            'lignes' => $lignes,
            'totaux' => ['Total', '', '', '', (int) $cancellations->sum(fn ($c) => $c->payment->montant_encaisse), '', '', ''],
        ]];
    }

    private function reductionsTable($payments): array
    {
        $lignes = $payments->map(fn (Payment $p) => [
            Dates::displayDateTime($p->created_at),
            $p->numero_recu,
            $p->member->nom_complet ?? 'Ticket séance',
            $p->plan->nom,
            $p->montant_du,
            $p->reduction,
            $p->motif_reduction,
            $p->user->nom,
            $p->reductionApprover?->nom,
        ])->all();

        return [$lignes, [
            'titre' => 'Réductions accordées',
            'colonnes' => ['Date', 'Reçu', 'Membre', 'Formule', 'Prix', 'Réduction', 'Motif', 'Encaisseur', 'Autorisée par'],
            'lignes' => $lignes,
            'totaux' => ['Total', '', '', '', '', (int) $payments->sum('reduction'), '', '', ''],
        ]];
    }

    private function expensesTable(array $data): array
    {
        return [$data, [
            'titre' => 'Dépenses validées par catégorie',
            'colonnes' => ['Catégorie', 'Total (FCFA)'],
            'lignes' => array_map(fn ($r) => [$r['libelle'], $r['total']], $data['par_categorie']),
            'totaux' => ['Total', $data['total']],
        ]];
    }

    private function cashTable($sessions): array
    {
        $lignes = $sessions->map(fn (CashSession $s) => [
            Dates::displayDateTime($s->ouverte_at),
            Dates::displayDateTime($s->fermee_at) ?? 'OUVERTE',
            $s->user->nom,
            $s->fond_initial,
            $s->especes_attendues,
            $s->especes_comptees,
            $s->ecart,
            $s->motif_ecart,
            $s->commentaire_admin,
        ])->all();

        return [$lignes, [
            'titre' => 'Sessions de caisse',
            'colonnes' => ['Ouverture', 'Clôture', 'Employé', 'Fond', 'Attendu', 'Compté', 'Écart', 'Motif', 'Commentaire admin'],
            'lignes' => $lignes,
            'totaux' => ['Total', '', '', '', '', '', (int) $sessions->sum('ecart'), '', ''],
        ]];
    }

    private function csv(array $table, string $filename): StreamedResponse
    {
        return response()->streamDownload(function () use ($table) {
            $out = fopen('php://output', 'w');
            // BOM UTF-8 + séparateur « ; » : ouverture directe dans Excel en français.
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, [$table['titre']], ';', '"', '');
            fputcsv($out, $table['colonnes'], ';', '"', '');
            foreach ($table['lignes'] as $ligne) {
                fputcsv($out, array_map(fn ($v) => $v ?? '', $ligne), ';', '"', '');
            }
            if (! empty($table['totaux'])) {
                fputcsv($out, $table['totaux'], ';', '"', '');
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function periodLabel(string $from, string $to): string
    {
        $f = CarbonImmutable::parse($from)->format('d/m/Y');
        $t = CarbonImmutable::parse($to)->format('d/m/Y');

        return $from === $to ? $f : "du {$f} au {$t}";
    }
}
