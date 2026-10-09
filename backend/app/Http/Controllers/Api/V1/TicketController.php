<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\TicketResource;
use App\Models\Ticket;
use App\Services\PdfService;
use App\Services\QrCodeService;
use App\Support\Dates;
use App\Support\Settings;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class TicketController extends Controller
{
    public function show(Ticket $ticket, QrCodeService $qr): JsonResponse
    {
        $message = sprintf(
            "%s — Ticket séance %s valable le %s.\nPrésentez ce code à l'entrée : %s",
            Settings::get('nom_salle'),
            $ticket->numero,
            $ticket->valable_le->format('d/m/Y'),
            $ticket->numero,
        );

        return response()->json([
            'data' => new TicketResource($ticket),
            'qr_data_uri' => $qr->dataUri($ticket->qr_token),
            // Lien WhatsApp pré-rempli (sans API) : le réceptionniste choisit le destinataire.
            'whatsapp_url' => 'https://wa.me/?text='.rawurlencode($message),
            'whatsapp_url_membre' => $ticket->member?->telephone
                ? 'https://wa.me/'.ltrim($ticket->member->telephone, '+').'?text='.rawurlencode($message)
                : null,
            'aujourd_hui' => Dates::todayString(),
        ]);
    }

    public function qr(Ticket $ticket, QrCodeService $qr): Response
    {
        return response($qr->svg($ticket->qr_token), 200, ['Content-Type' => 'image/svg+xml', 'Cache-Control' => 'no-store']);
    }

    public function pdf(Ticket $ticket, PdfService $pdf): Response
    {
        return $pdf->ticket($ticket);
    }
}
