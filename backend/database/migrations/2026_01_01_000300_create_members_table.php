<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('members', function (Blueprint $table) {
            $table->id();
            $table->string('nom', 100);
            $table->string('prenom', 100);
            // Format normalisé +221XXXXXXXXX ; l'unicité détecte les doublons.
            $table->string('telephone', 20)->unique();
            $table->string('email')->nullable();
            $table->date('date_naissance')->nullable();
            $table->string('sexe', 1)->nullable();
            $table->string('photo_path')->nullable();
            $table->string('contact_urgence', 150)->nullable();
            $table->text('notes')->nullable();
            $table->date('date_inscription');
            // Jeton opaque du QR membre : créé au premier paiement, régénérable par l'admin.
            $table->string('qr_token', 64)->nullable()->unique();
            $table->timestamp('qr_genere_at')->nullable();
            $table->string('statut', 20)->default('actif')->index();
            // Nom + prénom + téléphone sans accents ni majuscules, pour la recherche rapide.
            $table->string('recherche', 300)->index();
            $table->timestamp('anonymise_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('members');
    }
};
