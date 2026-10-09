<?php

namespace App\Services;

use App\Enums\AccessType;
use App\Enums\ScanResult;
use App\Models\AccessLog;
use App\Models\Member;
use App\Models\Subscription;
use App\Models\Ticket;

/** Résultat d'une décision de contrôle d'accès, prêt à être renvoyé au poste de scan. */
final class ScanOutcome
{
    public function __construct(
        public readonly ScanResult $result,
        public readonly string $message,
        public readonly AccessType $type = AccessType::Entree,
        public readonly ?Member $member = null,
        public readonly ?Ticket $ticket = null,
        public readonly ?Subscription $subscription = null,
        public readonly ?string $dateFin = null,
        public readonly ?int $joursRestants = null,
        public ?AccessLog $log = null,
    ) {}
}
