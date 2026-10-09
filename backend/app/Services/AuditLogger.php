<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

/**
 * Journal d'audit : qui, quand, quoi, avant/après, adresse IP.
 * Appelé explicitement par les services pour chaque action sensible.
 */
class AuditLogger
{
    /** Champs jamais écrits dans le journal. */
    private const REDACTED = ['password', 'remember_token', 'qr_token', 'recherche'];

    /**
     * @param  array<string, mixed>|null  $avant
     * @param  array<string, mixed>|null  $apres
     */
    public function log(
        string $action,
        Model|string|null $entity = null,
        ?array $avant = null,
        ?array $apres = null,
        ?User $user = null,
    ): AuditLog {
        $request = request();

        return AuditLog::create([
            'user_id' => $user->id ?? Auth::id(),
            'action' => $action,
            'entite' => $entity instanceof Model ? class_basename($entity) : $entity,
            'entite_id' => $entity instanceof Model ? $entity->getKey() : null,
            'avant' => $this->clean($avant),
            'apres' => $this->clean($apres),
            'ip' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
            'created_at' => now(),
        ]);
    }

    /**
     * Différence avant/après d'un modèle modifié (appeler avant save(), après fill()).
     *
     * @return array{0: array<string, mixed>, 1: array<string, mixed>}
     */
    public function diff(Model $model): array
    {
        $dirty = $model->getDirty();
        $before = array_intersect_key($model->getOriginal(), $dirty);

        return [$this->normalize($before), $this->normalize($dirty)];
    }

    /**
     * @param  array<string, mixed>|null  $values
     * @return array<string, mixed>|null
     */
    private function clean(?array $values): ?array
    {
        if ($values === null) {
            return null;
        }

        foreach (self::REDACTED as $key) {
            if (array_key_exists($key, $values)) {
                $values[$key] = '[masqué]';
            }
        }

        return $this->normalize($values);
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function normalize(array $values): array
    {
        return array_map(function ($value) {
            return match (true) {
                $value instanceof \BackedEnum => $value->value,
                $value instanceof \DateTimeInterface => $value->format(DATE_ATOM),
                default => $value,
            };
        }, $values);
    }
}
