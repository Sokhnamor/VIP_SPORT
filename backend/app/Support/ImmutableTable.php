<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Défense en profondeur : en MySQL, la base elle-même refuse toute modification ou
 * suppression des lignes d'une table protégée, même depuis un client SQL.
 * Les modèles Eloquent bloquent aussi ces opérations (App\Models\Concerns\Immutable).
 *
 * Note : avec le binlog activé, MySQL exige log_bin_trust_function_creators=1
 * (ou le privilège SUPER) pour créer des triggers. Voir docs/EXPLOITATION.md.
 */
final class ImmutableTable
{
    public static function protect(string $table): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        foreach (['UPDATE', 'DELETE'] as $event) {
            $name = $table.'_no_'.strtolower($event);
            DB::unprepared("DROP TRIGGER IF EXISTS {$name}");
            DB::unprepared(
                "CREATE TRIGGER {$name} BEFORE {$event} ON {$table} FOR EACH ROW "
                ."SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Table {$table} en lecture seule'"
            );
        }
    }

    public static function release(string $table): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::unprepared("DROP TRIGGER IF EXISTS {$table}_no_update");
        DB::unprepared("DROP TRIGGER IF EXISTS {$table}_no_delete");
    }
}
