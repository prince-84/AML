<?php

namespace App\Models;

use App\Models\Concerns\CompanyOwned;
use Illuminate\Database\Eloquent\Model;

class TmRule extends Model
{
    use CompanyOwned;

    protected $fillable = ['company_id','code','name','description','params','is_enabled','severity'];

    protected function casts(): array
    {
        return ['params' => 'array', 'is_enabled' => 'boolean'];
    }
}
