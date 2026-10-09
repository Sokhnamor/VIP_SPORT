<?php

namespace App\Enums;

enum TicketStatus: string
{
    case Valide = 'valide';
    case Utilise = 'utilise';
    case Annule = 'annule';
    // Calculé : ticket non utilisé d'un jour passé.
    case Expire = 'expire';

    public function label(): string
    {
        return match ($this) {
            self::Valide => 'Valide',
            self::Utilise => 'Utilisé',
            self::Annule => 'Annulé',
            self::Expire => 'Expiré',
        };
    }
}
