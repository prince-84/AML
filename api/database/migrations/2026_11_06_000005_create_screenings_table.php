<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('screenings', function (Blueprint $t) {
            $t->id();
            $t->foreignId('company_id')->constrained()->cascadeOnDelete();
            $t->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $t->string('subject_name');
            $t->date('subject_dob')->nullable();
            $t->string('subject_nationality')->nullable();
            $t->enum('mode', ['local','opensanctions','test'])->default('local');
            $t->enum('source', ['auto','manual','name_checker','bulk'])->default('manual');
            $t->decimal('threshold', 4, 2)->default(0.70);
            $t->string('engine_version')->default('local-1.0');
            $t->enum('status', ['clear','potential_match','confirmed'])->default('clear');
            $t->unsignedSmallInteger('best_score')->default(0);
            $t->unsignedInteger('candidates_count')->default(0);
            $t->unsignedInteger('duration_ms')->nullable();
            $t->unsignedInteger('credits_used')->default(0);
            $t->json('results')->nullable();
            $t->foreignId('performed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['company_id','created_at']);
        });
    }
    public function down(): void { Schema::dropIfExists('screenings'); }
};
