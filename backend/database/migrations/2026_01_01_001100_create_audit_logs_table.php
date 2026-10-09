<?php

use App\Support\ImmutableTable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users');
            $table->string('action', 60)->index();
            $table->string('entite', 60)->nullable();
            $table->unsignedBigInteger('entite_id')->nullable();
            $table->json('avant')->nullable();
            $table->json('apres')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamp('created_at')->index();

            $table->index(['entite', 'entite_id']);
        });

        // Journal d'audit en lecture seule, y compris au niveau de la base.
        ImmutableTable::protect('audit_logs');
    }

    public function down(): void
    {
        ImmutableTable::release('audit_logs');
        Schema::dropIfExists('audit_logs');
    }
};
