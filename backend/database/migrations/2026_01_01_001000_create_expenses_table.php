<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->date('date_depense')->index();
            $table->string('categorie', 30)->index();
            $table->unsignedInteger('montant');
            $table->text('description');
            $table->string('mode', 20);
            $table->string('justificatif_path')->nullable();
            // en_attente | validee | rejetee | annulee
            $table->string('statut', 20)->default('en_attente')->index();
            $table->foreignId('user_id')->constrained('users');
            // Renseigné si la dépense a été payée en espèces depuis la caisse.
            $table->foreignId('cash_session_id')->nullable()->constrained('cash_sessions');
            $table->foreignId('valide_par')->nullable()->constrained('users');
            $table->timestamp('valide_at')->nullable();
            $table->text('motif_decision')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};
