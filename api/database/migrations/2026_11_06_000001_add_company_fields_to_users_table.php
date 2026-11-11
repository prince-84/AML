<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('users', function (Blueprint $t) {
            $t->foreignId('company_id')->nullable()->after('id')->constrained('companies')->nullOnDelete();
            $t->enum('role', ['owner','mlro','officer','viewer'])->default('officer')->after('email');
            $t->string('phone')->nullable()->after('role');
            $t->timestamp('last_login_at')->nullable()->after('phone');
        });
    }
    public function down(): void {
        Schema::table('users', function (Blueprint $t) {
            $t->dropConstrainedForeignId('company_id');
            $t->dropColumn(['role','phone','last_login_at']);
        });
    }
};
