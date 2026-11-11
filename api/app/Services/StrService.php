<?php

namespace App\Services;

use App\Models\AmlCase;
use App\Models\ScreeningAlert;
use App\Models\StrReport;
use App\Models\TmAlert;
use App\Models\Transaction;

class StrService
{
    public function __construct(private GoAmlService $goAml) {}

    /**
     * Create an STR draft for a case, prefilled from the customer,
     * their alerts and flagged transactions. Generates goAML XML.
     */
    public function createDraft(AmlCase $case, ?int $userId = null): StrReport
    {
        $company = $case->company()->first();
        $customer = $case->customer()->withoutGlobalScopes()->first();

        $flagged = $customer
            ? Transaction::withoutGlobalScopes()->where('company_id', $case->company_id)->where('customer_id', $customer->id)->where('flagged', true)->get()
            : collect();
        $amount = (float) $flagged->sum('amount');

        $grounds = [];
        if ($customer) {
            $tmTitles = TmAlert::withoutGlobalScopes()
                ->where('company_id', $case->company_id)
                ->where('customer_id', $customer->id)
                ->pluck('rule_code')->unique()->values()->all();
            foreach ($tmTitles as $code) $grounds[] = 'transaction monitoring rule '.$code;
            $sa = ScreeningAlert::withoutGlobalScopes()
                ->where('company_id', $case->company_id)
                ->where('customer_id', $customer->id)
                ->orderByDesc('match_score')->first();
            if ($sa) $grounds[] = "a {$sa->match_score}% name-screening match against {$sa->list_name} ({$sa->matched_name})";
        }

        $reason = 'Suspicious activity identified during ongoing monitoring: '
            .($grounds ? implode('; ', $grounds) : $case->title).'.';

        $name = $customer?->full_name ?? 'Unknown subject';
        $narrative = "This report concerns {$name}"
            .($customer ? " (customer {$customer->customer_no}" : '')
            .($customer?->nationality ? ", national of {$customer->nationality}" : '')
            .($customer ? ')' : '')
            .". The subject's activity was escalated to case {$case->case_no} ({$case->title}). "
            .($flagged->count()
                ? "A total of {$flagged->count()} flagged transaction(s) amounting to AED ".number_format($amount, 2)." were identified. "
                : '')
            ."Grounds for suspicion: {$reason} "
            ."The relationship is under review by the MLRO and supporting records, screening evidence and audit trail are retained in ComplyShield.";

        $report = StrReport::create([
            'company_id' => $case->company_id,
            'case_id' => $case->id,
            'customer_id' => $customer?->id,
            'report_no' => StrReport::nextNumber($case->company_id),
            'report_type' => 'STR',
            'status' => 'draft',
            'reason' => $reason,
            'narrative' => $narrative,
            'amount_involved' => $amount,
        ]);

        if ($company) {
            $report->goaml_xml = $this->goAml->generate($company, $customer, [
                'report_type' => $report->report_type,
                'report_no' => $report->report_no,
                'amount_involved' => $report->amount_involved,
                'reason' => $report->reason,
                'narrative' => $report->narrative,
            ]);
            $report->save();
        }

        return $report;
    }
}
