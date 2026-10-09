<?php

namespace App\Support;

/**
 * Jetons opaques des QR codes : 160 bits aléatoires (CSPRNG), aucune donnée personnelle.
 * Préfixe M- pour un membre, T- pour un ticket.
 */
final class Token
{
    public const MEMBER_PREFIX = 'M-';

    public const TICKET_PREFIX = 'T-';

    public static function member(): string
    {
        return self::MEMBER_PREFIX.self::random();
    }

    public static function ticket(): string
    {
        return self::TICKET_PREFIX.self::random();
    }

    /** Numéro lisible de ticket, ex. T-7K3QF9XA (ce n'est PAS le jeton du QR). */
    public static function ticketNumber(): string
    {
        $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        $out = '';
        for ($i = 0; $i < 8; $i++) {
            $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return 'T-'.$out;
    }

    /** Normalise une saisie (scan ou clavier) avant recherche en base. */
    public static function normalizeInput(string $raw): string
    {
        return strtoupper(preg_replace('/\s+/', '', trim($raw)) ?? '');
    }

    /**
     * 20 octets = 160 bits, encodés en base32 (32 caractères A–Z, 2–7) :
     * insensible à la casse, donc saisissable à la main en secours.
     */
    private static function random(): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $bits = '';
        foreach (str_split(random_bytes(20)) as $byte) {
            $bits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        }

        $out = '';
        foreach (str_split($bits, 5) as $chunk) {
            $out .= $alphabet[bindec($chunk)];
        }

        return $out;
    }
}
