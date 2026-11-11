<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('tm_rules', function (Blueprint $t) {
            $t->id();
            $t->foreignId('company_id')->constrained()->cascadeOnDelete();
            $t->string('code');
            $t->string('name');
            $t->text('description')->nullable();
            $t->json('params')->nullable();
            $t->boolean('is_enabled')->default(true);
            $t->enum('severity', ['low','medium','high'])->default('medium');
            $t->timestamps();
            $t->unique(['company_id','code']);
        });
    }
    public function down(): void { Schema::dropIfExists('tm_rules'); }
};
