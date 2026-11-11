<?php

namespace App\Models;

use App\Models\Concerns\CompanyOwned;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use CompanyOwned, SoftDeletes;

    protected $fillable = [
        'company_id','customer_no','type','member_category','residency','full_name',
        'first_name','middle_name','last_name','name_ar','dob','gender','nationality',
        'occupation','employer','source_of_funds','expected_activity','email','phone',
        'whatsapp','address_line','city','country','status','kyc_status','screening_status',
        'risk_level','risk_score','edd_required','edd_status','next_review_date','notes','created_by',
    ];

    protected function casts(): array
    {
        return [
            'dob' => 'date',
            'next_review_date' => 'date',
            'edd_required' => 'boolean',
        ];
    }

    public static function nextNumber(int $companyId): string
    {
        $count = static::withoutGlobalScopes()->withTrashed()->where('company_id', $companyId)->count();
        return 'CUS-'.str_pad($count + 1, 6, '0', STR_PAD_LEFT);
    }

    public function documents() { return $this->hasMany(CustomerDocument::class); }
    public function screenings() { return $this->hasMany(Screening::class); }
    public function alerts() { return $this->hasMany(ScreeningAlert::class); }
    public function transactions() { return $this->hasMany(Transaction::class); }
    public function tmAlerts() { return $this->hasMany(TmAlert::class); }
    public function cases() { return $this->hasMany(AmlCase::class); }
}
