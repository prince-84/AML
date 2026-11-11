<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmlCase;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Screening;
use App\Models\ScreeningAlert;
use App\Models\TmAlert;
use App\Models\WatchlistEntry;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $company = $request->user()->company;
        $today = Carbon::today();

        $screeningsTotal = Screening::count();
        $potential = Screening::where('status', 'potential_match')->count();
        $openScreeningAlerts = ScreeningAlert::whereIn('status', ['open', 'under_review'])->count();

        $byDay = Screening::query()
            ->select(DB::raw('DATE(created_at) as day'), DB::raw('COUNT(*) as count'))
            ->where('created_at', '>=', $today->copy()->subDays(13))
            ->groupBy('day')
            ->pluck('count', 'day');
        $screeningsByDay = [];
        for ($i = 13; $i >= 0; $i--) {
            $d = $today->copy()->subDays($i)->format('Y-m-d');
            $screeningsByDay[] = ['date' => $d, 'count' => (int) ($byDay[$d] ?? 0)];
        }

        $activity = AuditLog::where('company_id', $company->id)
            ->with('user:id,name,role')
            ->latest()
            ->limit(10)
            ->get();

        $listsLoaded = WatchlistEntry::where('is_active', true)->count();

        return ApiResponse::ok([
            'company' => $company,
            'counts' => [
                'customers_total' => Customer::count(),
                'customers_new_today' => Customer::whereDate('created_at', $today)->count(),
                'kyc_pending' => Customer::where('kyc_status', 'pending')->count(),
                'reviews_overdue' => ScreeningAlert::whereIn('status', ['open', 'under_review'])->where('due_at', '<', now())->count()
                    + Customer::where('edd_status', 'pending')->whereNotNull('next_review_date')->where('next_review_date', '<', $today)->count(),
                'screenings_today' => Screening::whereDate('created_at', $today)->count(),
                'screenings_total' => $screeningsTotal,
                'open_screening_alerts' => $openScreeningAlerts,
                'overdue_alerts' => ScreeningAlert::whereIn('status', ['open', 'under_review'])->where('due_at', '<', now())->count(),
                'open_tm_alerts' => TmAlert::whereIn('status', ['open', 'under_review'])->count(),
                'open_cases' => AmlCase::whereNotIn('status', ['closed_no_action', 'str_filed', 'customer_exited'])->count(),
                'high_risk_customers' => Customer::whereIn('risk_level', ['high', 'severe'])->count(),
                'active_aml_cases' => AmlCase::whereIn('status', ['open', 'investigating', 'pending_mlro'])->count(),
                'edd_due' => Customer::where('edd_required', true)->where('edd_status', 'pending')->count(),
                'documents_to_verify' => \App\Models\CustomerDocument::where('verified', false)->count(),
                'mlro_escalations' => AmlCase::where('status', 'pending_mlro')->count(),
            ],
            'potential_match_pct' => $screeningsTotal ? round($potential / $screeningsTotal * 100, 1) : 0.0,
            'screening_volume' => [
                'total' => $screeningsTotal,
                'potential_matches' => $potential,
                'by_day' => $screeningsByDay,
            ],
            'kyc_breakdown' => Customer::select('kyc_status', DB::raw('COUNT(*) as count'))->groupBy('kyc_status')->pluck('count', 'kyc_status'),
            'screening_breakdown' => Customer::select('screening_status', DB::raw('COUNT(*) as count'))->groupBy('screening_status')->pluck('count', 'screening_status'),
            'risk_breakdown' => Customer::select('risk_level', DB::raw('COUNT(*) as count'))->groupBy('risk_level')->pluck('count', 'risk_level'),
            'alerts_by_priority' => ScreeningAlert::whereIn('status', ['open', 'under_review'])
                ->select('priority', DB::raw('COUNT(*) as count'))->groupBy('priority')->pluck('count', 'priority'),
            'pipeline' => [
                'engine' => 'Ready',
                'worker' => 'Online',
                'lists_loaded' => $listsLoaded,
                'queue' => 0,
            ],
            'recent_activity' => $activity,
        ]);
    }
}
