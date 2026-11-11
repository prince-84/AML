<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('customers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('company_id')->constrained()->cascadeOnDelete();
            $t->string('customer_no');
            $t->enum('type', ['individual','corporate'])->default('individual');
            $t->enum('member_category', ['walk_in','regular','vip','corporate'])->default('walk_in');
            $t->enum('residency', ['resident','non_resident','gcc'])->default('resident');
            $t->string('full_name');
            $t->string('first_name')->nullable();
            $t->string('middle_name')->nullable();
            $t->string('last_name')->nullable();
            $t->string('name_ar')->nullable();
            $t->date('dob')->nullable();
            $t->string('gender')->nullable();
            $t->string('nationality')->nullable();
            $t->string('occupation')->nullable();
            $t->string('employer')->nullable();
            $t->string('source_of_funds')->nullable();
            $t->string('expected_activity')->nullable();
            $t->string('email')->nullable();
            $t->string('phone')->nullable();
            $t->string('whatsapp')->nullable();
            $t->string('address_line')->nullable();
            $t->string('city')->nullable();
            $t->string('country')->nullable();
            $t->enum('status', ['pending_kyc','active','restricted','rejected','archived'])->default('pending_kyc');
            $t->enum('kyc_status', ['pending','approved','rejected'])->default('pending');
            $t->enum('screening_status', ['not_screened','clear','potential_match','under_review','confirmed_match'])->default('not_screened');
            $t->enum('risk_level', ['low','medium','high','severe'])->nullable();
            $t->unsignedSmallInteger('risk_score')->nullable();
            $t->boolean('edd_required')->default(false);
            $t->enum('edd_status', ['not_required','pending','completed'])->default('not_required');
            $t->date('next_review_date')->nullable();
            $t->text('notes')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->softDeletes();
            $t->unique(['company_id','customer_no']);
            $t->index(['company_id','status']);
            $t->index(['company_id','risk_level']);
        });
    }
    public function down(): void { Schema::dropIfExists('customers'); }
};
