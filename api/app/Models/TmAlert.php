<?php

namespace App\Models;

use App\Models\Concerns\CompanyOwned;
use Illuminate\Database\Eloquent\Model;

class TmAlert extends Model
{
    use CompanyOwned;

    protected $fillable = [
        'company_id','transaction_id','customer_id','rule_code','title','description',
        'severity','status','decided_by','decided_at','notes',
    ];

    protected function casts(): array
    {
        return ['decided_at' => 'datetime'];
    }

    public function customer() { return $this->belongsTo(Customer::class); }
    public function transaction() { return $this->belongsTo(Transaction::class); }
}
