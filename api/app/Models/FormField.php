<?php

namespace App\Models;

use App\Models\Concerns\CompanyOwned;
use Illuminate\Database\Eloquent\Model;

class FormField extends Model
{
    use CompanyOwned;

    protected $fillable = ['company_id','field_key','label','section','is_mandatory','is_enabled','sort'];

    protected function casts(): array
    {
        return ['is_mandatory' => 'boolean', 'is_enabled' => 'boolean'];
    }
}
