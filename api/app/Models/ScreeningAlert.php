<?php

namespace App\Models;

use App\Models\Concerns\CompanyOwned;
use Illuminate\Database\Eloquent\Model;

class ScreeningAlert extends Model
{
    use CompanyOwned;

    protected $fillable = [
        'company_id','customer_id','screening_id','watchlist_entry_id','external_ref',
        'matched_name','match_score','list_name','priority','status','decision_notes',
        'decided_by','decided_at','due_at',
    ];

    protected function casts(): array
    {
        return ['decided_at' => 'datetime', 'due_at' => 'datetime'];
    }

    public function customer() { return $this->belongsTo(Customer::class); }
    public function screening() { return $this->belongsTo(Screening::class); }
    public function watchlistEntry() { return $this->belongsTo(WatchlistEntry::class); }
}
