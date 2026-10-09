<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->constrained('members');
            $table->foreignId('plan_id')->constrained('plans');
            // Un abonnement n'existe que par un paiement (1 paiement = 1 abonnement).
            $table->foreignId('payment_id')->unique()->constrained('payments');
            $table->date('date_debut');
            $table->date('date_fin');
            // Date de fin d'origine, conservée si l'admin prolonge après une suspension.
            $table->date('date_fin_initiale');
            // Stocké : actif | suspendu | annule. « expire » et « a_venir » sont calculés.
            $table->string('statut', 20)->default('actif')->index();
            $table->text('suspendu_motif')->nullable();
            $table->timestamp('suspendu_at')->nullable();
            $table->foreignId('suspendu_par')->nullable()->constrained('users');
            $table->timestamp('annule_at')->nullable();
            $table->timestamps();

            $table->index(['member_id', 'date_debut', 'date_fin']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};
