<?php

namespace App\Enums;

enum ExpenseCategory: string
{
    case Loyer = 'loyer';
    case Electricite = 'electricite';
    case Eau = 'eau';
    case Salaires = 'salaires';
    case Materiel = 'materiel';
    case Entretien = 'entretien';
    case Internet = 'internet';
    case Autre = 'autre';

    public function label(): string
    {
        return match ($this) {
            self::Loyer => 'Loyer',
            self::Electricite => 'Électricité',
            self::Eau => 'Eau',
            self::Salaires => 'Salaires',
            self::Materiel => 'Matériel',
            self::Entretien => 'Entretien',
            self::Internet => 'Internet',
            self::Autre => 'Autre',
        };
    }
}
