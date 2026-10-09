<?php

namespace App\Support;

final class Money
{
    /** 20000 → « 20 000 FCFA » */
    public static function fcfa(int $amount): string
    {
        return number_format($amount, 0, ',', ' ').' FCFA';
    }
}
