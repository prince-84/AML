<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmlCase;
use App\Services\AuditLogger;
use App\Services\StrService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class CaseController extends Controller
{
    public function __construct(private StrService $strService) {}

    public function index(Request $request)
    {
        $q = AmlCase::query()->with('customer:id,full_name,customer_no', 'assignee:id,name')->latest();
        foreach (['status', 'source', 'customer_id', 'priority'] as $f) {
            if ($v = $request->query($f)) $q->where($f, $v);
        }
        return ApiResponse::paginated($q->paginate(15));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'customer_id' => ['nullable', 'integer'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'priority' => ['sometimes', 'in:low,medium,high'],
            'assigned_to' => ['nullable', 'integer'],
        ]);
        $user = $request->user();
        $case = AmlCase::create(array_merge($data, [
            'company_id' => $user->company_id,
            'case_no' => AmlCase::nextNumber($user->company_id),
            'source' => 'manual',
            'status' => 'open',
            'opened_by' => $user->id,
            'due_at' => now()->addDays(7),
        ]));
        AuditLogger::log('case.created', $user->company_id, $user->id, 'case', $case->id, ['title' => $case->title]);
        return ApiResponse::ok(['case' => $case], 'Case opened.', 201);
    }

    public function show(AmlCase $case)
    {
        return ApiResponse::ok(['case' => $case->load('customer.transactions', 'customer.documents', 'assignee', 'strReports')]);
    }

    public function update(Request $request, AmlCase $case)
    {
        $data = $request->validate([
            'status' => ['sometimes', 'in:open,investigating,pending_mlro,closed_no_action,str_filed,customer_exited'],
            'assigned_to' => ['nullable', 'integer'],
            'priority' => ['sometimes', 'in:low,medium,high'],
            'resolution' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'due_at' => ['nullable', 'date'],
        ]);
        $case->update($data);
        if (isset($data['status']) && in_array($data['status'], ['closed_no_action', 'str_filed', 'customer_exited'], true) && !$case->closed_at) {
            $case->closed_at = now();
            $case->save();
        }
        return ApiResponse::ok(['case' => $case->fresh()], 'Case updated.');
    }

    public function createStr(Request $request, AmlCase $case)
    {
        $report = $this->strService->createDraft($case, $request->user()->id);
        return ApiResponse::ok(['str_report' => $report], 'STR draft created from case.', 201);
    }
}
