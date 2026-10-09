<?php

namespace App\Enums;

enum CashSessionStatus: string
{
    case Ouverte = 'ouverte';
    case Cloturee = 'cloturee';
}
