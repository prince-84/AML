<?php

namespace App\Models;

use App\Models\Concerns\CompanyOwned;
use Illuminate\Database\Eloquent\Model;

class CustomerDocument extends Model
{
    use CompanyOwned;

    protected $fillable = [
        'company_id','customer_id','doc_type','doc_number','issuing_country','issue_date',
        'expiry_date','file_name','verified','verification','verified_by','verified_at',
    ];

    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'expiry_date' => 'date',
            'verified' => 'boolean',
            'verification' => 'array',
            'verified_at' => 'datetime',
        ];
    }

    public function customer() { return $this->belongsTo(Customer::class); }
}
