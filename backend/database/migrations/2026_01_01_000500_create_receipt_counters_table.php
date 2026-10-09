<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Un compteur par année, verrouillé pendant la transaction de paiement :
        // si la transaction échoue, l'incrément est annulé avec elle (aucun trou).
        Schema::create('receipt_counters', function (Blueprint $table) {
            $table->unsignedSmallInteger('annee')->primary();
            $table->unsignedInteger('dernier_numero')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('receipt_counters');
    }
};
