<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('risk_assessments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('company_id')->constrained()->cascadeOnDelete();
            $t->string('title');
            $t->string('period')->nullable();
            $t->enum('status', ['draft','in_review','approved'])->default('draft');
            $t->unsignedSmallInteger('inherent_score')->nullable();
            $t->unsignedSmallInteger('customer_score')->nullable();
            $t->unsignedSmallInteger('products_score')->nullable();
            $t->unsignedSmallInteger('channels_score')->nullable();
            $t->unsignedSmallInteger('geography_score')->nullable();
            $t->unsignedSmallInteger('counterparty_score')->nullable();
            $t->unsignedSmallInteger('residual_score')->nullable();
            $t->text('methodology_note')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('risk_assessments'); }
};
