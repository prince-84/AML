<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    protected $fillable = ['company_id','user_id','action','subject_type','subject_id','meta','ip'];

    protected function casts(): array
    {
        return ['meta' => 'array'];
    }

    public function user() { return $this->belongsTo(User::class); }
}
