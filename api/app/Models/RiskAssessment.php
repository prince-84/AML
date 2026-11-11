<?php

namespace App\Models;

use App\Models\Concerns\CompanyOwned;
use Illuminate\Database\Eloquent\Model;

class RiskAssessment extends Model
{
    use CompanyOwned;

    protected $fillable = [
        'company_id','title','period','status','inherent_score','customer_score','products_score',
        'channels_score','geography_score','counterparty_score','residual_score',
        'methodology_note','created_by','approved_by',
    ];
}
