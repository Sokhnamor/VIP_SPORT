<?php

namespace App\Enums;

enum Role: string
{
    case Admin = 'admin';
    case Receptionniste = 'receptionniste';
    case Scanner = 'scanner';

    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Administrateur',
            self::Receptionniste => 'Réceptionniste',
            self::Scanner => 'Poste de scan',
        };
    }

    /** Minutes d'inactivité avant déconnexion automatique. */
    public function inactivityTimeout(): int
    {
        return match ($this) {
            self::Scanner => 12 * 60,
            default => 30,
        };
    }
}
