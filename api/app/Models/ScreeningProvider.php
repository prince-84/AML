<?php

namespace App\Models;

use App\Models\Concerns\CompanyOwned;
use Illuminate\Database\Eloquent\Model;

class ScreeningProvider extends Model
{
    use CompanyOwned;

    protected $fillable = [
        'company_id','provider','is_enabled','mode','api_key','threshold','logic',
        'dataset_size','sync_schedule','last_sync_at','status_text',
    ];

    protected $hidden = ['api_key'];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'api_key' => 'encrypted',
            'threshold' => 'decimal:2',
            'last_sync_at' => 'datetime',
        ];
    }
}
