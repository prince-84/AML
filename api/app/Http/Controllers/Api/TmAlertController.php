<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmlCase;
use App\Models\TmAlert;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class TmAlertController extends Controller
{
    public function index(Request $request)
    {
        $q = TmAlert::query()->with('customer:id,full_name,customer_no', 'transaction:id,txn_no,amount,txn_date')->latest();
        foreach (['status', 'severity', 'rule_code', 'customer_id'] as $f) {
            if ($v = $request->query($f)) $q->where($f, $v);
        }
        return ApiResponse::paginated($q->paginate(15));
    }

    public function decision(Request $request, TmAlert $tmAlert)
    {
        $data = $request->validate([
            'decision' => ['required', 'in:close_benign,escalate'],
            'notes' => ['nullable', 'string'],
        ]);
        $user = $request->user();
        $case = null;

        $tmAlert->decided_by = $user->id;
        $tmAlert->decided_at = now();
        $tmAlert->notes = $data['notes'] ?? $tmAlert->notes;

        if ($data['decision'] === 'close_benign') {
            $tmAlert->status = 'closed_benign';
            $tmAlert->save();
        } else {
            $tmAlert->status = 'escalated_to_case';
            $tmAlert->save();
            $customer = $tmAlert->customer()->withoutGlobalScopes()->first();
            $case = AmlCase::create([
                'company_id' => $tmAlert->company_id,
                'case_no' => AmlCase::nextNumber($tmAlert->company_id),
                'customer_id' => $tmAlert->customer_id,
                'source' => 'transaction',
                'title' => $tmAlert->title.' — '.($customer?->full_name ?? ''),
                'description' => $tmAlert->description,
                'status' => 'open',
                'priority' => $tmAlert->severity === 'high' ? 'high' : 'medium',
                'opened_by' => $user->id,
                'due_at' => now()->addDays(5),
            ]);
            AuditLogger::log('case.created', $tmAlert->company_id, $user->id, 'case', $case->id, ['from_tm_alert' => $tmAlert->id]);
        }

        return ApiResponse::ok(['tm_alert' => $tmAlert->fresh(), 'case' => $case], 'Decision recorded.');
    }
}
