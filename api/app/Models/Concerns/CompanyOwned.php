<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

trait CompanyOwned
{
    protected static function bootCompanyOwned(): void
    {
        static::addGlobalScope('company', function (Builder $query) {
            if (auth()->check() && auth()->user()->company_id) {
                $query->where($query->getModel()->getTable().'.company_id', auth()->user()->company_id);
            }
        });

        static::creating(function ($model) {
            if (empty($model->company_id) && auth()->check() && auth()->user()->company_id) {
                $model->company_id = auth()->user()->company_id;
            }
        });
    }

    public function company()
    {
        return $this->belongsTo(\App\Models\Company::class);
    }
}
