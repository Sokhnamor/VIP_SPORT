<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AccessLogResource;
use App\Http\Resources\CashSessionResource;
use App\Services\AlertService;
use App\Services\PdfService;
use App\Support\Phone;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\Response;

class AlertController extends Controller
{
    public function __construct(private readonly AlertService $alerts) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => [
            'resume' => $this->alerts->summary(),
            'expirent_bientot' => $this->memberRows($this->alerts->expiringSoon()),
            'expires_recemment' => $this->memberRows($this->alerts->recentlyExpired()),
            'caisses_non_cloturees' => CashSessionResource::collection($this->alerts->unclosedSessions()),
            'ecarts_caisse' => CashSessionResource::collection($this->alerts->cashDiscrepancies()),
            'refus_scan' => $this->alerts->refusalRateToday(),
            'entrees_manuelles' => AccessLogResource::collection($this->alerts->recentManualEntries()),
        ]]);
    }

    /** Export des listes de relance (expirant bientôt / expirés récemment) en CSV ou PDF. */
    public function export(Request $request, string $liste, PdfService $pdf): Response
    {
        abort_unless(in_array($liste, ['expirent-bientot', 'expires-recemment'], true), 404);

        $rows = $liste === 'expirent-bientot' ? $this->alerts->expiringSoon() : $this->alerts->recentlyExpired();
        $table = [
            'titre' => $liste === 'expirent-bientot' ? 'Abonnements expirant bientôt' : 'Abonnements expirés depuis moins de 30 jours',
            'colonnes' => ['Membre', 'Téléphone', 'Couvert jusqu\'au', 'Jours restants'],
            'lignes' => $rows->map(fn ($r) => [
                $r['member']->nom_complet,
                Phone::display($r['member']->telephone),
                CarbonImmutable::parse($r['couvert_jusqu_au'])->format('d/m/Y'),
                $r['jours_restants'],
            ])->values()->all(),
        ];

        if ($request->query('format') === 'pdf') {
            return $pdf->table($table, "{$liste}.pdf");
        }

        return response()->streamDownload(function () use ($table) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, $table['colonnes'], ';', '"', '');
            foreach ($table['lignes'] as $ligne) {
                fputcsv($out, $ligne, ';', '"', '');
            }
            fclose($out);
        }, "{$liste}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function memberRows(Collection $rows): Collection
    {
        return $rows->map(fn ($r) => [
            'member_id' => $r['member']->id,
            'nom' => $r['member']->nom_complet,
            'telephone' => $r['member']->telephone,
            'couvert_jusqu_au' => $r['couvert_jusqu_au'],
            'jours_restants' => $r['jours_restants'],
        ])->values();
    }
}
