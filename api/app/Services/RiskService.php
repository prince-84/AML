<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\ScreeningAlert;

class RiskService
{
    public const HIGH_RISK_COUNTRIES = [
        'afghanistan','iran','north korea','syria','yemen','russia','myanmar','sudan',
        'south sudan','somalia','venezuela','belarus','cuba','nicaragua','mali','burkina faso',
    ];

    /**
     * Contract point rules. Returns [score, level, edd_required].
     */
    public function score(Customer $customer): array
    {
        $points = 0;

        $nat = mb_strtolower(trim((string) $customer->nationality));
        if ($nat !== '' && in_array($nat, self::HIGH_RISK_COUNTRIES, true)) {
            $points += 35;
        }

        // PEP relation or sanctions partial match: open screening alert, a
        // potential/under-review screening state, or confirmed match.
        $hasOpenAlert = ScreeningAlert::withoutGlobalScopes()
            ->where('company_id', $customer->company_id)
            ->where('customer_id', $customer->id)
            ->whereIn('status', ['open', 'under_review', 'escalated'])
            ->exists();
        if ($hasOpenAlert || in_array($customer->screening_status, ['potential_match', 'under_review', 'confirmed_match'], true)) {
            $points += 40;
        }

        $activity = mb_strtolower((string) $customer->expected_activity);
        if (str_contains($activity, 'cash')) {
            $points += 10; // cash-heavy expected activity
        }
        if (str_contains($activity, 'high') || str_contains($activity, 'large')) {
            $points += 10; // high expected volume
        }
        if ($customer->residency === 'non_resident') {
            $points += 10;
        }
        $occupation = mb_strtolower((string) $customer->occupation);
        if (str_contains($occupation, 'dealer') || str_contains($occupation, 'broker')) {
            $points += 5;
        }

        $score = max(0, min(100, $points));
        $level = $score >= 80 ? 'severe' : ($score >= 60 ? 'high' : ($score >= 30 ? 'medium' : 'low'));

        return [$score, $level, $score >= 60];
    }

    public function recompute(Customer $customer): Customer
    {
        [$score, $level, $edd] = $this->score($customer);
        $customer->risk_score = $score;
        $customer->risk_level = $level;
        $customer->edd_required = $edd;
        if ($edd && $customer->edd_status === 'not_required') {
            $customer->edd_status = 'pending';
        }
        if (!$edd && $customer->edd_status === 'pending') {
            $customer->edd_status = 'not_required';
        }
        $customer->save();
        return $customer;
    }
}
