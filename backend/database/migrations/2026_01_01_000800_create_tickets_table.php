<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            // Numéro lisible (T-XXXXXXXX) distinct du jeton du QR.
            $table->string('numero', 20)->unique();
            $table->foreignId('payment_id')->unique()->constrained('payments');
            $table->foreignId('member_id')->nullable()->constrained('members');
            $table->string('qr_token', 64)->unique();
            $table->date('valable_le')->index();
            // Stocké : valide | utilise | annule. « expire » est calculé (valable_le passé).
            $table->string('statut', 20)->default('valide');
            $table->timestamp('utilise_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
