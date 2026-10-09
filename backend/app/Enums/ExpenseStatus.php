<?php

namespace App\Enums;

enum ExpenseStatus: string
{
    case EnAttente = 'en_attente';
    case Validee = 'validee';
    case Rejetee = 'rejetee';
    case Annulee = 'annulee';

    public function label(): string
    {
        return match ($this) {
            self::EnAttente => 'En attente',
            self::Validee => 'Validée',
            self::Rejetee => 'Rejetée',
            self::Annulee => 'Annulée',
        };
    }
}
