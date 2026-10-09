<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users');
            $table->timestamp('ouverte_at');
            $table->unsignedInteger('fond_initial');
            $table->timestamp('fermee_at')->nullable();
            $table->unsignedInteger('especes_attendues')->nullable();
            $table->unsignedInteger('especes_comptees')->nullable();
            $table->integer('ecart')->nullable();
            $table->text('motif_ecart')->nullable();
            $table->string('statut', 20)->default('ouverte')->index();
            // = user_id tant que la session est ouverte, NULL après clôture.
            // L'index unique garantit en base une seule session ouverte par utilisateur.
            $table->unsignedBigInteger('verrou_ouverte')->nullable()->unique();
            $table->text('commentaire_admin')->nullable();
            $table->foreignId('commente_par')->nullable()->constrained('users');
            $table->timestamp('commente_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_sessions');
    }
};
