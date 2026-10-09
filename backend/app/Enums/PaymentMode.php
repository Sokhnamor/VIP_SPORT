<?php

namespace App\Enums;

enum PaymentMode: string
{
    case Especes = 'especes';
    case Wave = 'wave';
    case OrangeMoney = 'orange_money';
    case Autre = 'autre';

    public function label(): string
    {
        return match ($this) {
            self::Especes => 'Espèces',
            self::Wave => 'Wave',
            self::OrangeMoney => 'Orange Money',
            self::Autre => 'Autre',
        };
    }

    /** Wave et Orange Money exigent une référence de transaction unique. */
    public function requiresReference(): bool
    {
        return $this === self::Wave || $this === self::OrangeMoney;
    }
}
