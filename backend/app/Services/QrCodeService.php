<?php

namespace App\Services;

use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

/** Génération des QR codes côté serveur (SVG : net à l'impression, aucune extension requise). */
class QrCodeService
{
    public function svg(string $content, int $size = 300): string
    {
        $writer = new Writer(new ImageRenderer(new RendererStyle($size, 2), new SvgImageBackEnd));

        return $writer->writeString($content);
    }

    /** Data-URI pour intégration dans les PDF (dompdf) et les réponses JSON. */
    public function dataUri(string $content, int $size = 300): string
    {
        return 'data:image/svg+xml;base64,'.base64_encode($this->svg($content, $size));
    }
}
