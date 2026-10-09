<?php

namespace App\Services;

use App\Support\Dates;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Numéros de reçu séquentiels sans trou : REC-AAAA-NNNNNN.
 *
 * Doit être appelé DANS la transaction du paiement : la ligne du compteur est verrouillée
 * (SELECT … FOR UPDATE) jusqu'au commit, et si la transaction échoue l'incrément est
 * annulé avec elle. Deux ventes simultanées sont donc sérialisées et aucun numéro n'est perdu.
 */
class ReceiptNumberGenerator
{
    public function next(): string
    {
        if (DB::transactionLevel() === 0) {
            throw new LogicException('Le numéro de reçu doit être généré dans une transaction.');
        }

        $year = (int) Dates::now()->format('Y');

        DB::table('receipt_counters')->insertOrIgnore(['annee' => $year, 'dernier_numero' => 0]);

        $current = (int) DB::table('receipt_counters')
            ->where('annee', $year)
            ->lockForUpdate()
            ->value('dernier_numero');

        $next = $current + 1;

        DB::table('receipt_counters')->where('annee', $year)->update(['dernier_numero' => $next]);

        return sprintf('REC-%d-%06d', $year, $next);
    }
}
