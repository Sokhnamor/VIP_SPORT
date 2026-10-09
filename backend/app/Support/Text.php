<?php

namespace App\Support;

use Illuminate\Support\Str;

final class Text
{
    /** Minuscules, sans accents, espaces simples : base de la recherche tolérante. */
    public static function normalize(?string $value): string
    {
        $ascii = Str::ascii((string) $value);
        $lower = strtolower($ascii);
        $clean = preg_replace('/[^a-z0-9+ ]+/', ' ', $lower) ?? '';

        return trim(preg_replace('/\s+/', ' ', $clean) ?? '');
    }
}
