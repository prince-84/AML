<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Services\TransactionMonitor;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class TransactionController extends Controller
{
    public function __construct(private TransactionMonitor $monitor) {}

    public function index(Request $request)
    {
        $q = Transaction::query()
            ->with([
                'customer:id,full_name,customer_no,risk_level,risk_score,nationality',
                'tmAlerts'
            ])
            ->latest('txn_date')
            ->latest('id');

        foreach (['customer_id', 'payment_method', 'type', 'metal_type'] as $f) {
            if ($v = $request->query($f)) $q->where($f, $v);
        }
        if ($request->query('flagged')) $q->where('flagged', true);
        if ($rule = $request->query('rule_code')) {
            $q->whereHas('tmAlerts', fn($aq) => $aq->where('rule_code', $rule));
        }
        if ($alertStatus = $request->query('alert_status')) {
            $q->whereHas('tmAlerts', fn($aq) => $aq->where('status', $alertStatus));
        }
        if ($severity = $request->query('severity')) {
            $q->whereHas('tmAlerts', fn($aq) => $aq->where('severity', $severity));
        }
        if ($s = $request->query('search')) {
            $q->where(function ($query) use ($s) {
                $query->where('txn_no', 'like', "%{$s}%")
                    ->orWhere('item_description', 'like', "%{$s}%")
                    ->orWhereHas('customer', function ($cq) use ($s) {
                        $cq->where('full_name', 'like', "%{$s}%")
                            ->orWhere('customer_no', 'like', "%{$s}%");
                    });
            });
        }
        $perPage = $request->query('per_page', 15);
        if ($perPage === 'all' || $request->boolean('all') || $request->query('paginate') === 'false') {
            $items = $q->get();
            return ApiResponse::ok([
                'items' => $items,
                'total' => $items->count(),
                'per_page' => $items->count(),
                'current_page' => 1,
                'last_page' => 1,
            ]);
        }
        return ApiResponse::paginated($q->paginate((int) $perPage));
    }

    public function stats(Request $request)
    {
        $companyId = $request->user()->company_id;
        $totalTxns = Transaction::where('company_id', $companyId)->count();
        $totalVolume = (float) Transaction::where('company_id', $companyId)->sum('amount');
        $flaggedTxns = Transaction::where('company_id', $companyId)->where('flagged', true)->count();
        $flaggedVolume = (float) Transaction::where('company_id', $companyId)->where('flagged', true)->sum('amount');

        $openAlerts = \App\Models\TmAlert::where('company_id', $companyId)->where('status', 'open')->count();
        $highSeverityAlerts = \App\Models\TmAlert::where('company_id', $companyId)->whereIn('severity', ['high', 'critical'])->count();

        return ApiResponse::ok([
            'total_transactions' => $totalTxns,
            'total_volume' => $totalVolume,
            'flagged_count' => $flaggedTxns,
            'flagged_volume' => $flaggedVolume,
            'open_alerts_count' => $openAlerts,
            'high_severity_count' => $highSeverityAlerts,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'customer_id' => ['required', 'integer'],
            'txn_date' => ['sometimes', 'date'],
            'type' => ['sometimes', 'in:buy,sell,remittance,policy,service'],
            'item_description' => ['nullable', 'string', 'max:255'],
            'metal_type' => ['nullable', 'in:gold,silver,diamond,platinum'],
            'weight_grams' => ['nullable', 'numeric', 'min:0'],
            'amount' => ['required', 'numeric', 'min:0'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'payment_method' => ['sometimes', 'in:cash,card,bank_transfer,cheque'],
            'channel' => ['sometimes', 'in:counter,online,phone'],
        ]);

        $customer = \App\Models\Customer::find($data['customer_id']);
        if (!$customer) return ApiResponse::error('Customer not found.', 404);

        $user = $request->user();
        $data['company_id'] = $user->company_id;
        $data['txn_no'] = Transaction::nextNumber($user->company_id);
        $data['txn_date'] = $data['txn_date'] ?? now()->toDateString();
        $data['created_by'] = $user->id;

        $txn = Transaction::create($data);
        $alertsCreated = $this->monitor->runForTransaction($user->company, $txn);

        return ApiResponse::ok([
            'transaction' => $txn->fresh(),
            'alerts_created' => $alertsCreated,
        ], 'Transaction recorded.', 201);
    }

    public function show(Transaction $transaction)
    {
        return ApiResponse::ok(['transaction' => $transaction->load('customer', 'tmAlerts')]);
    }

    public function runMonitor(Request $request)
    {
        $created = $this->monitor->runAll($request->user()->company);
        return ApiResponse::ok(['alerts_created' => $created], "Monitor scan complete — {$created} new alert(s).");
    }
}
