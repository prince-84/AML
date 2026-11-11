<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StrReport;
use App\Services\AuditLogger;
use App\Services\GoAmlService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class StrReportController extends Controller
{
    public function __construct(private GoAmlService $goAml) {}

    public function index(Request $request)
    {
        $q = StrReport::query()->with('customer:id,full_name,customer_no', 'amlCase:id,case_no,title')->latest();
        foreach (['status', 'report_type', 'customer_id', 'case_id'] as $f) {
            if ($v = $request->query($f)) $q->where($f, $v);
        }
        return ApiResponse::paginated($q->paginate(15));
    }

    public function show(StrReport $strReport)
    {
        return ApiResponse::ok(['str_report' => $strReport->load('customer', 'amlCase')]);
    }

    public function update(Request $request, StrReport $strReport)
    {
        $data = $request->validate([
            'status' => ['sometimes', 'in:draft,under_review,filed'],
            'reason' => ['nullable', 'string'],
            'narrative' => ['nullable', 'string'],
            'amount_involved' => ['sometimes', 'numeric', 'min:0'],
        ]);

        if (($data['status'] ?? null) === 'filed') {
            if (!$request->user()->hasRole(['owner', 'mlro'])) {
                return ApiResponse::error('Only the owner or MLRO can file an STR.', 403);
            }
            $strReport->filed_at = now();
            $strReport->filed_by = $request->user()->id;
        }
        $strReport->update(collect($data)->except([])->all());
        $strReport->save();

        // Refresh goAML XML after edits.
        $company = $strReport->company()->first();
        $customer = $strReport->customer()->withoutGlobalScopes()->first();
        if ($company) {
            $strReport->goaml_xml = $this->goAml->generate($company, $customer, [
                'report_type' => $strReport->report_type,
                'report_no' => $strReport->report_no,
                'amount_involved' => $strReport->amount_involved,
                'reason' => $strReport->reason,
                'narrative' => $strReport->narrative,
            ]);
            $strReport->save();
        }

        if (($data['status'] ?? null) === 'filed') {
            AuditLogger::log('str.filed', $strReport->company_id, $request->user()->id, 'str_report', $strReport->id, ['report_no' => $strReport->report_no]);
            if ($strReport->case_id) {
                $case = $strReport->amlCase()->withoutGlobalScopes()->first();
                if ($case && $case->status !== 'str_filed') {
                    $case->status = 'str_filed';
                    $case->closed_at = now();
                    $case->save();
                }
            }
        }

        return ApiResponse::ok(['str_report' => $strReport->fresh()], 'Report updated.');
    }

    public function goaml(StrReport $strReport)
    {
        $xml = $strReport->goaml_xml;
        if (!$xml) {
            $company = $strReport->company()->first();
            $customer = $strReport->customer()->withoutGlobalScopes()->first();
            $xml = $company ? $this->goAml->generate($company, $customer, [
                'report_type' => $strReport->report_type,
                'report_no' => $strReport->report_no,
                'amount_involved' => $strReport->amount_involved,
                'reason' => $strReport->reason,
                'narrative' => $strReport->narrative,
            ]) : '<report/>';
        }
        return response($xml, 200, [
            'Content-Type' => 'application/xml',
            'Content-Disposition' => 'attachment; filename="'.$strReport->report_no.'.xml"',
        ]);
    }
}
