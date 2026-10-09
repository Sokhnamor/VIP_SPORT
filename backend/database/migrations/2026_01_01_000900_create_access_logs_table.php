<?php

use App\Support\ImmutableTable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('access_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->nullable()->constrained('members');
            $table->foreignId('ticket_id')->nullable()->constrained('tickets');
            $table->foreignId('subscription_id')->nullable()->constrained('subscriptions');
            $table->string('token_scanne', 100)->nullable();
            $table->string('resultat', 30)->index();
            $table->string('type', 10)->default('entree');
            $table->boolean('manuel')->default(false)->index();
            $table->text('motif_manuel')->nullable();
            $table->foreignId('user_id')->constrained('users');
            $table->timestamp('scanned_at')->index();
            $table->string('ip', 45)->nullable();

            $table->index(['member_id', 'scanned_at']);
            $table->index(['ticket_id', 'scanned_at']);
        });

        Schema::create('presences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->nullable()->constrained('members');
            $table->foreignId('ticket_id')->nullable()->constrained('tickets');
            $table->foreignId('access_log_id')->constrained('access_logs');
            $table->timestamp('entree_at')->index();
            $table->timestamp('sortie_at')->nullable();
            $table->boolean('cloture_auto')->default(false);
            $table->timestamps();
        });

        // Le journal des accès (y compris les refus) ne doit jamais être altéré.
        ImmutableTable::protect('access_logs');
    }

    public function down(): void
    {
        ImmutableTable::release('access_logs');
        Schema::dropIfExists('presences');
        Schema::dropIfExists('access_logs');
    }
};
