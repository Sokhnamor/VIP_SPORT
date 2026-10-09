<?php

namespace App\Support;

/**
 * Numéros sénégalais : 9 chiffres (mobiles 70–78, fixes 33), indicatif +221.
 * Stockage normalisé : +221XXXXXXXXX.
 */
final class Phone
{
    public static function normalize(?string $raw): ?string
    {
        if ($raw === null) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $raw) ?? '';

        if (str_starts_with($digits, '00221')) {
            $digits = substr($digits, 5);
        } elseif (str_starts_with($digits, '221') && strlen($digits) === 12) {
            $digits = substr($digits, 3);
        }

        if (! preg_match('/^(7[0-8]|33)\d{7}$/', $digits)) {
            return null;
        }

        return '+221'.$digits;
    }

    public static function isValid(?string $raw): bool
    {
        return self::normalize($raw) !== null;
    }

    /** Affichage lisible : +221 77 123 45 67 */
    public static function display(?string $normalized): ?string
    {
        if (! $normalized || ! str_starts_with($normalized, '+221')) {
            return $normalized;
        }
        $d = substr($normalized, 4);

        return sprintf('+221 %s %s %s %s', substr($d, 0, 2), substr($d, 2, 3), substr($d, 5, 2), substr($d, 7, 2));
    }
}
