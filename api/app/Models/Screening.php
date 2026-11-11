<?php

namespace App\Models;

use App\Models\Concerns\CompanyOwned;
use Illuminate\Database\Eloquent\Model;

class Screening extends Model
{
    use CompanyOwned;

    protected $fillable = [
        'company_id','customer_id','subject_name','subject_dob','subject_nationality','mode',
        'source','threshold','engine_version','status','best_score','candidates_count',
        'duration_ms','credits_used','results','performed_by',
    ];

    protected function casts(): array
    {
        return [
            'subject_dob' => 'date',
            'threshold' => 'decimal:2',
            'results' => 'array',
        ];
    }

    public function customer() { return $this->belongsTo(Customer::class); }
    public function alerts() { return $this->hasMany(ScreeningAlert::class); }
    public function performer() { return $this->belongsTo(User::class, 'performed_by'); }
}
