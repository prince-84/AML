<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('api_usage', function (Blueprint $t) {
            $t->id();
            $t->foreignId('company_id')->constrained()->cascadeOnDelete();
            $t->string('provider');
            $t->unsignedInteger('calls')->default(0);
            $t->unsignedInteger('credits')->default(0);
            $t->string('month', 7);
            $t->string('source')->nullable();
            $t->timestamps();
            $t->index(['company_id','month']);
        });
    }
    public function down(): void { Schema::dropIfExists('api_usage'); }
};
