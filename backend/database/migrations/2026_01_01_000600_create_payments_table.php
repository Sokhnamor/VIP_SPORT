<?php

use App\Support\ImmutableTable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->string('numero_recu', 20)->unique();
            $table->foreignId('member_id')->nullable()->constrained('members');
            $table->foreignId('plan_id')->constrained('plans');
            // Prix figé au moment de la vente.
            $table->unsignedInteger('montant_du');
            $table->unsignedInteger('reduction')->default(0);
            $table->text('motif_reduction')->nullable();
            $table->foreignId('reduction_autorisee_par')->nullable()->constrained('users');
            $table->unsignedInteger('montant_encaisse');
            $table->string('mode', 20)->index();
            // Unique si non nul (NULL multiples autorisés) : empêche les doublons Wave / OM.
            $table->string('reference_transaction', 100)->nullable()->unique();
            $table->foreignId('user_id')->constrained('users');
            $table->foreignId('cash_session_id')->constrained('cash_sessions');
            $table->timestamp('created_at')->index();
        });

        Schema::create('payment_cancellations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->unique()->constrained('payments');
            $table->foreignId('user_id')->constrained('users');
            $table->text('motif');
            $table->timestamp('created_at')->index();
        });

        // Paiements et annulations : jamais modifiés ni supprimés, même en SQL direct.
        ImmutableTable::protect('payments');
        ImmutableTable::protect('payment_cancellations');
    }

    public function down(): void
    {
        ImmutableTable::release('payment_cancellations');
        ImmutableTable::release('payments');
        Schema::dropIfExists('payment_cancellations');
        Schema::dropIfExists('payments');
    }
};
