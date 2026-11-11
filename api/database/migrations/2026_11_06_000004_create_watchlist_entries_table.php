<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('watchlist_entries', function (Blueprint $t) {
            $t->id();
            $t->string('source_list');
            $t->string('external_id')->nullable();
            $t->string('full_name');
            $t->string('name_ar')->nullable();
            $t->json('aliases')->nullable();
            $t->date('dob')->nullable();
            $t->string('nationality')->nullable();
            $t->enum('entity_type', ['person','company'])->default('person');
            $t->json('programmes')->nullable();
            $t->text('summary')->nullable();
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->index('source_list');
        });
    }
    public function down(): void { Schema::dropIfExists('watchlist_entries'); }
};
