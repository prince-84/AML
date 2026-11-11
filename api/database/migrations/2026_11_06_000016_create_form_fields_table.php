<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('form_fields', function (Blueprint $t) {
            $t->id();
            $t->foreignId('company_id')->constrained()->cascadeOnDelete();
            $t->string('field_key');
            $t->string('label');
            $t->string('section');
            $t->boolean('is_mandatory')->default(false);
            $t->boolean('is_enabled')->default(true);
            $t->unsignedInteger('sort')->default(0);
            $t->timestamps();
            $t->unique(['company_id','field_key']);
        });
    }
    public function down(): void { Schema::dropIfExists('form_fields'); }
};
