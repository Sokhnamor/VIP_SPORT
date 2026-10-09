<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use DateTimeInterface;

/**
 * Toutes les règles « du jour » (validité, expiration, tickets) se calculent dans le
 * fuseau de la salle (Africa/Dakar), alors que la base stocke les horodatages en UTC.
 */
final class Dates
{
    public static function timezone(): string
    {
        return config('gym.timezone', 'Africa/Dakar');
    }

    /** Maintenant, dans le fuseau de la salle. */
    public static function now(): CarbonImmutable
    {
        return CarbonImmutable::now(self::timezone());
    }

    /** Aujourd'hui à 00:00 dans le fuseau de la salle. */
    public static function today(): CarbonImmutable
    {
        return self::now()->startOfDay();
    }

    /** Date du jour au format Y-m-d (fuseau de la salle). */
    public static function todayString(): string
    {
        return self::today()->toDateString();
    }

    /** Convertit une date locale (Y-m-d) en bornes UTC [début, fin] pour requêter les horodatages. */
    public static function dayBoundsUtc(string|DateTimeInterface $day): array
    {
        $start = CarbonImmutable::parse($day instanceof DateTimeInterface ? $day->format('Y-m-d') : $day, self::timezone())
            ->startOfDay();

        return [$start->utc(), $start->endOfDay()->utc()];
    }

    /** Bornes UTC d'une période de dates locales incluses. */
    public static function rangeBoundsUtc(string $from, string $to): array
    {
        return [
            CarbonImmutable::parse($from, self::timezone())->startOfDay()->utc(),
            CarbonImmutable::parse($to, self::timezone())->endOfDay()->utc(),
        ];
    }

    /** Format d'affichage JJ/MM/AAAA. */
    public static function display(?DateTimeInterface $date): ?string
    {
        return $date ? CarbonImmutable::instance($date)->setTimezone(self::timezone())->format('d/m/Y') : null;
    }

    /** Format d'affichage JJ/MM/AAAA HH:MM. */
    public static function displayDateTime(?DateTimeInterface $date): ?string
    {
        return $date ? CarbonImmutable::instance($date)->setTimezone(self::timezone())->format('d/m/Y H:i') : null;
    }

    /** Horodatage ISO 8601 avec le décalage de la salle (pour l'API). */
    public static function iso(?DateTimeInterface $date): ?string
    {
        return $date ? CarbonImmutable::instance($date)->setTimezone(self::timezone())->toIso8601String() : null;
    }
}
