<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('screening_providers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('company_id')->constrained()->cascadeOnDelete();
            $t->enum('provider', ['opensanctions','ofac','eu','un','uk','dowjones']);
            $t->boolean('is_enabled')->default(false);
            $t->enum('mode', ['realtime','file','loaded'])->default('realtime');
            $t->text('api_key')->nullable();
            $t->decimal('threshold', 4, 2)->default(0.70);
            $t->string('logic')->default('v2');
            $t->string('dataset_size')->nullable();
            $t->string('sync_schedule')->nullable();
            $t->dateTime('last_sync_at')->nullable();
            $t->string('status_text')->nullable();
            $t->timestamps();
            $t->unique(['company_id','provider']);
        });
    }
    public function down(): void { Schema::dropIfExists('screening_providers'); }
};
