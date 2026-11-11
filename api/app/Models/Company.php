<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Company extends Model
{
    protected $fillable = [
        'name','trade_license_no','sector','country','city','phone','email',
        'plan','plan_expires_at','screening_credits_used','status',
    ];

    protected function casts(): array
    {
        return ['plan_expires_at' => 'datetime'];
    }

    public function users() { return $this->hasMany(User::class); }
    public function customers() { return $this->hasMany(Customer::class); }
}
