<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('tm_alerts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('company_id')->constrained()->cascadeOnDelete();
            $t->foreignId('transaction_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $t->string('rule_code');
            $t->string('title');
            $t->text('description')->nullable();
            $t->enum('severity', ['low','medium','high'])->default('medium');
            $t->enum('status', ['open','under_review','closed_benign','escalated_to_case'])->default('open');
            $t->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $t->dateTime('decided_at')->nullable();
            $t->text('notes')->nullable();
            $t->timestamps();
            $t->index(['company_id','status']);
        });
    }
    public function down(): void { Schema::dropIfExists('tm_alerts'); }
};
