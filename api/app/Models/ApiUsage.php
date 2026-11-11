<?php

namespace App\Models;

use App\Models\Concerns\CompanyOwned;
use Illuminate\Database\Eloquent\Model;

class ApiUsage extends Model
{
    use CompanyOwned;

    protected $table = 'api_usage';

    protected $fillable = ['company_id','provider','calls','credits','month','source'];
}
