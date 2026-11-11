<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('companies', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('trade_license_no')->nullable();
            $t->enum('sector', ['jewellery','real_estate','insurance','audit','exchange','other'])->default('other');
            $t->string('country')->default('UAE');
            $t->string('city')->nullable();
            $t->string('phone')->nullable();
            $t->string('email')->nullable();
            $t->string('plan')->default('starter');
            $t->dateTime('plan_expires_at')->nullable();
            $t->unsignedInteger('screening_credits_used')->default(0);
            $t->string('status')->default('active');
            $t->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('companies'); }
};
