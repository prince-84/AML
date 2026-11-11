<?php

namespace App\Models;

use App\Models\Concerns\CompanyOwned;
use Illuminate\Database\Eloquent\Model;

class Transaction extends Model
{
    use CompanyOwned;

    protected $fillable = [
        'company_id','customer_id','txn_no','txn_date','type','item_description','metal_type',
        'weight_grams','amount','currency','payment_method','channel','status','flagged','created_by',
    ];

    protected function casts(): array
    {
        return [
            'txn_date' => 'date',
            'amount' => 'decimal:2',
            'weight_grams' => 'decimal:2',
            'flagged' => 'boolean',
        ];
    }

    public static function nextNumber(int $companyId): string
    {
        $count = static::withoutGlobalScopes()->where('company_id', $companyId)->count();
        return 'TXN-'.str_pad($count + 1, 6, '0', STR_PAD_LEFT);
    }

    public function customer() { return $this->belongsTo(Customer::class); }
    public function tmAlerts() { return $this->hasMany(TmAlert::class); }
}
