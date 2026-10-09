<?php

namespace App\Enums;

enum SubscriptionStatus: string
{
    // Stockés en base
    case Actif = 'actif';
    case Suspendu = 'suspendu';
    case Annule = 'annule';
    // Calculés à partir des dates
    case Expire = 'expire';
    case AVenir = 'a_venir';

    public function label(): string
    {
        return match ($this) {
            self::Actif => 'Actif',
            self::Suspendu => 'Suspendu',
            self::Annule => 'Annulé',
            self::Expire => 'Expiré',
            self::AVenir => 'À venir',
        };
    }
}
