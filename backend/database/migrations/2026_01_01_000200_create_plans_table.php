<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('nom', 100)->unique();
            $table->unsignedSmallInteger('duree_jours');
            // Montants en FCFA : entiers, jamais de décimales.
            $table->unsignedInteger('prix_fcfa');
            $table->boolean('est_seance')->default(false);
            $table->boolean('actif')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
