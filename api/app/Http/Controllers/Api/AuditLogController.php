<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $q = AuditLog::query()->with('user:id,name,role')->latest();
        $q->where('company_id', $request->user()->company_id);
        if ($a = $request->query('action')) $q->where('action', $a);
        return ApiResponse::paginated($q->paginate(20));
    }
}
