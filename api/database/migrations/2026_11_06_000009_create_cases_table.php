<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('cases', function (Blueprint $t) {
            $t->id();
            $t->foreignId('company_id')->constrained()->cascadeOnDelete();
            $t->string('case_no');
            $t->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $t->enum('source', ['screening','transaction','manual'])->default('manual');
            $t->string('title');
            $t->text('description')->nullable();
            $t->enum('status', ['open','investigating','pending_mlro','closed_no_action','str_filed','customer_exited'])->default('open');
            $t->enum('priority', ['low','medium','high'])->default('medium');
            $t->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('opened_by')->nullable()->constrained('users')->nullOnDelete();
            $t->dateTime('due_at')->nullable();
            $t->dateTime('closed_at')->nullable();
            $t->text('resolution')->nullable();
            $t->timestamps();
            $t->unique(['company_id','case_no']);
        });
    }
    public function down(): void { Schema::dropIfExists('cases'); }
};
