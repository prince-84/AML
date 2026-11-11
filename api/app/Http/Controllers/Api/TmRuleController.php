<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TmRule;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class TmRuleController extends Controller
{
    public function index()
    {
        return ApiResponse::ok(['rules' => TmRule::orderBy('id')->get()]);
    }

    public function update(Request $request, TmRule $tmRule)
    {
        $data = $request->validate([
            'is_enabled' => ['sometimes', 'boolean'],
            'params' => ['sometimes', 'array'],
            'severity' => ['sometimes', 'in:low,medium,high'],
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ]);
        $tmRule->update($data);
        return ApiResponse::ok(['rule' => $tmRule->fresh()], 'Rule updated.');
    }
}
