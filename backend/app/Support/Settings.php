<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

/**
 * Paramètres de la salle (table settings), typés d'après les valeurs par défaut de config/gym.php.
 */
final class Settings
{
    private const CACHE_KEY = 'gym.settings';

    /** @return array<string, mixed> */
    public static function all(): array
    {
        $stored = Cache::rememberForever(self::CACHE_KEY, fn () => Setting::query()->pluck('valeur', 'cle')->all());

        $values = [];
        foreach (config('gym.defaults') as $key => $default) {
            $values[$key] = array_key_exists($key, $stored)
                ? self::cast($stored[$key], $default)
                : $default;
        }

        return $values;
    }

    public static function get(string $key): mixed
    {
        return self::all()[$key] ?? null;
    }

    /** @param array<string, mixed> $values */
    public static function put(array $values): void
    {
        foreach ($values as $key => $value) {
            if (! array_key_exists($key, config('gym.defaults'))) {
                continue;
            }
            Setting::query()->updateOrCreate(
                ['cle' => $key],
                ['valeur' => is_bool($value) ? ($value ? '1' : '0') : ($value === null ? null : (string) $value)],
            );
        }
        Cache::forget(self::CACHE_KEY);
    }

    public static function flush(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    private static function cast(?string $value, mixed $default): mixed
    {
        return match (true) {
            is_bool($default) => $value === '1' || $value === 'true',
            is_int($default) => (int) $value,
            default => $value,
        };
    }
}
