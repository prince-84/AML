<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('customer_documents', function (Blueprint $t) {
            $t->id();
            $t->foreignId('company_id')->constrained()->cascadeOnDelete();
            $t->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $t->enum('doc_type', ['emirates_id','gcc_id','passport','labor_card','driving_license','trade_license','visa']);
            $t->string('doc_number');
            $t->string('issuing_country')->nullable();
            $t->date('issue_date')->nullable();
            $t->date('expiry_date')->nullable();
            $t->string('file_name')->nullable();
            $t->boolean('verified')->default(false);
            $t->json('verification')->nullable();
            $t->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $t->dateTime('verified_at')->nullable();
            $t->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('customer_documents'); }
};
