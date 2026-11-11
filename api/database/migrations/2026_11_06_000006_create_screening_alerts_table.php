<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('screening_alerts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('company_id')->constrained()->cascadeOnDelete();
            $t->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('screening_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('watchlist_entry_id')->nullable()->constrained('watchlist_entries')->nullOnDelete();
            $t->string('external_ref')->nullable();
            $t->string('matched_name');
            $t->unsignedSmallInteger('match_score');
            $t->string('list_name');
            $t->enum('priority', ['low','review','high'])->default('review');
            $t->enum('status', ['open','under_review','cleared_false_positive','confirmed_match','escalated'])->default('open');
            $t->text('decision_notes')->nullable();
            $t->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $t->dateTime('decided_at')->nullable();
            $t->dateTime('due_at')->nullable();
            $t->timestamps();
            $t->index(['company_id','status']);
        });
    }
    public function down(): void { Schema::dropIfExists('screening_alerts'); }
};
