<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('str_reports', function (Blueprint $t) {
            $t->id();
            $t->foreignId('company_id')->constrained()->cascadeOnDelete();
            $t->foreignId('case_id')->nullable()->constrained('cases')->nullOnDelete();
            $t->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $t->string('report_no');
            $t->enum('report_type', ['STR','SAR'])->default('STR');
            $t->enum('status', ['draft','under_review','filed'])->default('draft');
            $t->text('reason')->nullable();
            $t->text('narrative')->nullable();
            $t->decimal('amount_involved', 14, 2)->default(0);
            $t->longText('goaml_xml')->nullable();
            $t->dateTime('filed_at')->nullable();
            $t->foreignId('filed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->unique(['company_id','report_no']);
        });
    }
    public function down(): void { Schema::dropIfExists('str_reports'); }
};
