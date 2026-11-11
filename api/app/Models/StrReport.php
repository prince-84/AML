<?php

namespace App\Models;

use App\Models\Concerns\CompanyOwned;
use Illuminate\Database\Eloquent\Model;

class StrReport extends Model
{
    use CompanyOwned;

    protected $fillable = [
        'company_id','case_id','customer_id','report_no','report_type','status','reason',
        'narrative','amount_involved','goaml_xml','filed_at','filed_by',
    ];

    protected function casts(): array
    {
        return ['amount_involved' => 'decimal:2', 'filed_at' => 'datetime'];
    }

    public static function nextNumber(int $companyId): string
    {
        $count = static::withoutGlobalScopes()->where('company_id', $companyId)->count();
        return 'STR-'.now()->format('Y').'-'.str_pad($count + 1, 4, '0', STR_PAD_LEFT);
    }

    public function amlCase() { return $this->belongsTo(AmlCase::class, 'case_id'); }
    public function customer() { return $this->belongsTo(Customer::class); }
}
