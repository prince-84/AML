<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('transactions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('company_id')->constrained()->cascadeOnDelete();
            $t->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $t->string('txn_no');
            $t->date('txn_date');
            $t->enum('type', ['buy','sell','remittance','policy','service'])->default('buy');
            $t->string('item_description')->nullable();
            $t->enum('metal_type', ['gold','silver','diamond','platinum'])->nullable();
            $t->decimal('weight_grams', 10, 2)->nullable();
            $t->decimal('amount', 14, 2);
            $t->string('currency', 3)->default('AED');
            $t->enum('payment_method', ['cash','card','bank_transfer','cheque'])->default('cash');
            $t->enum('channel', ['counter','online','phone'])->default('counter');
            $t->string('status')->default('completed');
            $t->boolean('flagged')->default(false);
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->unique(['company_id','txn_no']);
            $t->index(['company_id','customer_id','txn_date']);
        });
    }
    public function down(): void { Schema::dropIfExists('transactions'); }
};
