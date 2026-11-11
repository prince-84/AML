<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WatchlistEntry extends Model
{
    protected $fillable = [
        'source_list','external_id','full_name','name_ar','aliases','dob',
        'nationality','entity_type','programmes','summary','is_active',
    ];

    protected function casts(): array
    {
        return [
            'aliases' => 'array',
            'programmes' => 'array',
            'dob' => 'date',
            'is_active' => 'boolean',
        ];
    }
}
