<?php

namespace App\Models\Concerns;

use LogicException;

/**
 * Enregistrements append-only : création autorisée, modification et suppression interdites.
 * Pour corriger un paiement, on crée une annulation (PaymentCancellation), jamais une mise à jour.
 */
trait Immutable
{
    public static function bootImmutable(): void
    {
        static::updating(function ($model) {
            throw new LogicException(class_basename($model).' est immuable : modification interdite.');
        });

        static::deleting(function ($model) {
            throw new LogicException(class_basename($model).' est immuable : suppression interdite.');
        });
    }
}
