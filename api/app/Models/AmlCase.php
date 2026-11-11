<?php

namespace App\Models;

use App\Models\Concerns\CompanyOwned;
use Illuminate\Database\Eloquent\Model;

class AmlCase extends Model
{
    use CompanyOwned;

    protected $table = 'cases';

    protected $fillable = [
        'company_id','case_no','customer_id','source','title','description','status',
        'priority','assigned_to','opened_by','due_at','closed_at','resolution',
    ];

    protected function casts(): array
    {
        return ['due_at' => 'datetime', 'closed_at' => 'datetime'];
    }

    public static function nextNumber(int $companyId): string
    {
        $count = static::withoutGlobalScopes()->where('company_id', $companyId)->count();
        return 'CASE-'.now()->format('Y').'-'.str_pad($count + 1, 3, '0', STR_PAD_LEFT);
    }

    public function customer() { return $this->belongsTo(Customer::class); }
    public function assignee() { return $this->belongsTo(User::class, 'assigned_to'); }
    public function strReports() { return $this->hasMany(StrReport::class, 'case_id'); }
}
