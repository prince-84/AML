<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmlCase;
use App\Models\ScreeningAlert;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class AlertController extends Controller
{
    public function index(Request $request)
    {
        $q = ScreeningAlert::query()->with('customer:id,full_name,customer_no,risk_level')->latest();
        foreach (['status', 'priority', 'customer_id'] as $f) {
            if ($v = $request->query($f)) $q->where($f, $v);
        }
        if ($request->query('overdue')) {
            $q->whereIn('status', ['open', 'under_review'])->where('due_at', '<', now());
        }
        return ApiResponse::paginated($q->paginate(15));
    }

    public function show(ScreeningAlert $alert)
    {
        return ApiResponse::ok(['alert' => $alert->load('customer', 'watchlistEntry', 'screening')]);
    }

    public function decision(Request $request, ScreeningAlert $alert)
    {
        $data = $request->validate([
            'decision' => ['required', 'in:clear_false_positive,confirm_match,escalate'],
            'notes' => ['nullable', 'string'],
        ]);
        $user = $request->user();
        $case = null;

        if ($data['decision'] === 'confirm_match' && !$user->hasRole(['owner', 'mlro'])) {
            return ApiResponse::error('Only the owner or MLRO can confirm a true match.', 403);
        }

        $alert->decided_by = $user->id;
        $alert->decided_at = now();
        $alert->decision_notes = $data['notes'] ?? $alert->decision_notes;

        $customer = $alert->customer()->withoutGlobalScopes()->first();

        if ($data['decision'] === 'clear_false_positive') {
            $alert->status = 'cleared_false_positive';
            $alert->save();
            if ($customer && $customer->screening_status === 'under_review') {
                $remaining = ScreeningAlert::withoutGlobalScopes()
                    ->where('customer_id', $customer->id)
                    ->whereIn('status', ['open', 'under_review', 'escalated'])
                    ->count();
                if ($remaining === 0) {
                    $customer->screening_status = 'clear';
                    $customer->save();
                }
            }
        } elseif ($data['decision'] === 'confirm_match') {
            $alert->status = 'confirmed_match';
            $alert->save();
            if ($customer) {
                $customer->screening_status = 'confirmed_match';
                $customer->status = 'restricted';
                $customer->save();
            }
        } else { // escalate
            $alert->status = 'escalated';
            $alert->save();
            $case = AmlCase::create([
                'company_id' => $alert->company_id,
                'case_no' => AmlCase::nextNumber($alert->company_id),
                'customer_id' => $alert->customer_id,
                'source' => 'screening',
                'title' => 'Screening match review — '.($customer?->full_name ?? $alert->matched_name),
                'description' => "Escalated from screening alert #{$alert->id}: {$alert->match_score}% match to {$alert->matched_name} on {$alert->list_name}.",
                'status' => 'open',
                'priority' => $alert->priority === 'high' ? 'high' : 'medium',
                'opened_by' => $user->id,
                'due_at' => now()->addDays(5),
            ]);
            AuditLogger::log('case.created', $alert->company_id, $user->id, 'case', $case->id, ['from_alert' => $alert->id]);
        }

        AuditLogger::log('alert.decided', $alert->company_id, $user->id, 'screening_alert', $alert->id, ['decision' => $data['decision']]);

        return ApiResponse::ok([
            'alert' => $alert->fresh(),
            'case' => $case,
            'customer' => $customer?->fresh(),
        ], 'Alert decision recorded.');
    }
}
