<?php

namespace App\Services;

use App\Models\CashSession;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Ticket;
use App\Support\Settings;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/** Documents imprimables (dompdf) : reçus, cartes membre, tickets, rapports. */
class PdfService
{
    public function __construct(private readonly QrCodeService $qr) {}

    /** Reçu : A5 ou ticket thermique 80 mm. */
    public function receipt(Payment $payment, string $format = 'a5'): Response
    {
        $payment->load(['member', 'plan', 'user', 'subscription', 'ticket', 'cancellation', 'reductionApprover']);

        $paper = $format === '80mm'
            ? [0, 0, 226.77, 600]   // 80 mm de large (en points)
            : 'a5';

        return Pdf::loadView('pdf.receipt', [
            'payment' => $payment,
            'gym' => $this->gym(),
            'format' => $format,
            'ticketQr' => $payment->ticket ? $this->qr->dataUri($payment->ticket->qr_token, 180) : null,
        ])
            ->setPaper($paper)
            ->stream($payment->numero_recu.'.pdf');
    }

    /** Carte de membre au format carte bancaire (85,6 × 54 mm). */
    public function memberCard(Member $member): Response
    {
        return Pdf::loadView('pdf.member-card', [
            'member' => $member,
            'gym' => $this->gym(),
            'qr' => $this->qr->dataUri($member->qr_token, 200),
            'photo' => $this->imageDataUri($member->photo_path),
        ])
            ->setPaper([0, 0, 242.65, 153.07])
            ->stream('carte-membre-'.$member->id.'.pdf');
    }

    public function ticket(Ticket $ticket): Response
    {
        return Pdf::loadView('pdf.ticket', [
            'ticket' => $ticket,
            'gym' => $this->gym(),
            'qr' => $this->qr->dataUri($ticket->qr_token, 220),
        ])
            ->setPaper([0, 0, 226.77, 400])
            ->stream($ticket->numero.'.pdf');
    }

    public function mobileMoney(CashSession $session, Collection $payments): Response
    {
        return Pdf::loadView('pdf.mobile-money', [
            'session' => $session,
            'payments' => $payments,
            'gym' => $this->gym(),
        ])
            ->setPaper('a4')
            ->stream('rapprochement-session-'.$session->id.'.pdf');
    }

    /** @param array{titre: string, colonnes: list<string>, lignes: list<list<mixed>>, totaux?: list<mixed>} $table */
    public function table(array $table, string $filename): Response
    {
        return Pdf::loadView('pdf.report', ['table' => $table, 'gym' => $this->gym()])
            ->setPaper('a4', count($table['colonnes']) > 6 ? 'landscape' : 'portrait')
            ->download($filename);
    }

    private function gym(): array
    {
        $settings = Settings::all();
        $settings['logo'] = $this->imageDataUri($settings['logo_path'] ?? null);

        return $settings;
    }

    private function imageDataUri(?string $path): ?string
    {
        if (! $path || ! Storage::disk('local')->exists($path)) {
            return null;
        }

        $mime = Storage::disk('local')->mimeType($path) ?: 'image/jpeg';

        return 'data:'.$mime.';base64,'.base64_encode(Storage::disk('local')->get($path));
    }
}
