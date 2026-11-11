<?php

namespace App\Services;

use App\Models\Company;
use App\Models\TmAlert;
use App\Models\TmRule;
use App\Models\Transaction;
use Illuminate\Support\Carbon;

class TransactionMonitor
{
    private function rules(Company $company): array
    {
        return TmRule::withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where('is_enabled', true)
            ->get()
            ->keyBy('code')
            ->all();
    }

    private function openAlertExists(int $companyId, string $ruleCode, int $customerId): bool
    {
        return TmAlert::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('rule_code', $ruleCode)
            ->where('customer_id', $customerId)
            ->whereIn('status', ['open', 'under_review'])
            ->exists();
    }

    private function txnAlertExists(int $companyId, string $ruleCode, int $transactionId): bool
    {
        return TmAlert::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('rule_code', $ruleCode)
            ->where('transaction_id', $transactionId)
            ->exists();
    }

    private function fire(Company $company, Transaction $txn, string $ruleCode, string $severity, string $title, string $description): ?TmAlert
    {
        $alert = TmAlert::create([
            'company_id' => $company->id,
            'transaction_id' => $txn->id,
            'customer_id' => $txn->customer_id,
            'rule_code' => $ruleCode,
            'title' => $title,
            'description' => $description,
            'severity' => $severity,
            'status' => 'open',
        ]);
        if (!$txn->flagged) {
            $txn->flagged = true;
            $txn->save();
        }
        return $alert;
    }

    /**
     * Evaluate all enabled rules around one transaction.
     * Returns the number of alerts created.
     */
    public function runForTransaction(Company $company, Transaction $txn): int
    {
        $rules = $this->rules($company);
        $created = 0;
        $customer = $txn->customer()->withoutGlobalScopes()->first();
        $name = $customer?->full_name ?? 'Customer';
        $amount = (float) $txn->amount;
        $date = Carbon::parse($txn->txn_date);

        // CASH_THRESHOLD — single cash txn >= threshold.
        if (isset($rules['CASH_THRESHOLD'])) {
            $limit = (float) ($rules['CASH_THRESHOLD']->params['threshold'] ?? 55000);
            if ($txn->payment_method === 'cash' && $amount >= $limit && !$this->txnAlertExists($company->id, 'CASH_THRESHOLD', $txn->id)) {
                $this->fire($company, $txn, 'CASH_THRESHOLD', $rules['CASH_THRESHOLD']->severity,
                    'Cash transaction above reporting threshold',
                    "{$name} made a cash {$txn->type} of AED ".number_format($amount, 2)." on {$date->format('d M Y')}, at or above the AED ".number_format($limit, 0)." reporting threshold.");
                $created++;
            }
        }

        // HIGH_VALUE — any method >= threshold.
        if (isset($rules['HIGH_VALUE'])) {
            $limit = (float) ($rules['HIGH_VALUE']->params['threshold'] ?? 200000);
            if ($amount >= $limit && !$this->txnAlertExists($company->id, 'HIGH_VALUE', $txn->id)) {
                $this->fire($company, $txn, 'HIGH_VALUE', $rules['HIGH_VALUE']->severity,
                    'High-value transaction',
                    "{$name} completed a {$txn->type} of AED ".number_format($amount, 2)." on {$date->format('d M Y')}, above the AED ".number_format($limit, 0)." high-value threshold.");
                $created++;
            }
        }

        // STRUCTURING — >=N cash txns in window, each below report limit, total >= limit.
        if (isset($rules['STRUCTURING']) && $txn->payment_method === 'cash') {
            $p = $rules['STRUCTURING']->params ?? [];
            $limit = (float) ($p['threshold'] ?? 55000);
            $need = (int) ($p['count'] ?? 3);
            $days = (int) ($p['days'] ?? 7);
            if ($amount < $limit && !$this->openAlertExists($company->id, 'STRUCTURING', $txn->customer_id)) {
                $window = Transaction::withoutGlobalScopes()
                    ->where('company_id', $company->id)
                    ->where('customer_id', $txn->customer_id)
                    ->where('payment_method', 'cash')
                    ->where('amount', '<', $limit)
                    ->whereBetween('txn_date', [$date->copy()->subDays($days - 1)->toDateString(), $date->toDateString()])
                    ->get();
                if ($window->count() >= $need && (float) $window->sum('amount') >= $limit) {
                    $this->fire($company, $txn, 'STRUCTURING', $rules['STRUCTURING']->severity,
                        'Possible structuring — split cash transactions',
                        "{$name} made {$window->count()} cash transactions totalling AED ".number_format((float) $window->sum('amount'), 2)." within {$days} days, each below the AED ".number_format($limit, 0)." threshold — a pattern consistent with structuring.");
                    $created++;
                }
            }
        }

        // RAPID_SUCCESSION — >=N txns in the same 24h window.
        if (isset($rules['RAPID_SUCCESSION'])) {
            $p = $rules['RAPID_SUCCESSION']->params ?? [];
            $need = (int) ($p['count'] ?? 5);
            if (!$this->openAlertExists($company->id, 'RAPID_SUCCESSION', $txn->customer_id)) {
                $count = Transaction::withoutGlobalScopes()
                    ->where('company_id', $company->id)
                    ->where('customer_id', $txn->customer_id)
                    ->whereDate('txn_date', $date->toDateString())
                    ->count();
                if ($count >= $need) {
                    $this->fire($company, $txn, 'RAPID_SUCCESSION', $rules['RAPID_SUCCESSION']->severity,
                        'Rapid succession of transactions',
                        "{$name} completed {$count} transactions on {$date->format('d M Y')}, above the rapid-succession limit of {$need} per day.");
                    $created++;
                }
            }
        }

        // HIGH_RISK_CUSTOMER — txn by a high/severe risk customer.
        if (isset($rules['HIGH_RISK_CUSTOMER']) && $customer && in_array($customer->risk_level, ['high', 'severe'], true)) {
            if (!$this->txnAlertExists($company->id, 'HIGH_RISK_CUSTOMER', $txn->id)) {
                $this->fire($company, $txn, 'HIGH_RISK_CUSTOMER', $rules['HIGH_RISK_CUSTOMER']->severity,
                    'Transaction by high-risk customer',
                    "{$name} is rated ".strtoupper($customer->risk_level)." risk (score {$customer->risk_score}) and completed a {$txn->type} of AED ".number_format($amount, 2)." on {$date->format('d M Y')}.");
                $created++;
            }
        }

        // DORMANT_SPIKE — first activity after >=90 quiet days, amount >= threshold.
        if (isset($rules['DORMANT_SPIKE'])) {
            $p = $rules['DORMANT_SPIKE']->params ?? [];
            $days = (int) ($p['days'] ?? 90);
            $limit = (float) ($p['threshold'] ?? 100000);
            if ($amount >= $limit && !$this->openAlertExists($company->id, 'DORMANT_SPIKE', $txn->customer_id)) {
                $previous = Transaction::withoutGlobalScopes()
                    ->where('company_id', $company->id)
                    ->where('customer_id', $txn->customer_id)
                    ->where('id', '!=', $txn->id)
                    ->whereDate('txn_date', '<', $date->toDateString())
                    ->orderByDesc('txn_date')
                    ->first();
                if ($previous && Carbon::parse($previous->txn_date)->diffInDays($date) >= $days) {
                    $this->fire($company, $txn, 'DORMANT_SPIKE', $rules['DORMANT_SPIKE']->severity,
                        'Dormant account spike',
                        "{$name} transacted AED ".number_format($amount, 2)." after ".Carbon::parse($previous->txn_date)->diffInDays($date)." days without activity.");
                    $created++;
                }
            }
        }

        return $created;
    }

    /** Re-scan every transaction of the company (chronological). */
    public function runAll(Company $company): int
    {
        $created = 0;
        $txns = Transaction::withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->orderBy('txn_date')
            ->orderBy('id')
            ->get();
        foreach ($txns as $txn) {
            $created += $this->runForTransaction($company, $txn);
        }
        return $created;
    }
}
