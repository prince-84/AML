<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Customer;
use App\Models\CustomerDocument;

class GoAmlService
{
    private function e($value): string
    {
        return htmlspecialchars((string) ($value ?? ''), ENT_XML1 | ENT_COMPAT, 'UTF-8');
    }

    /**
     * Minimal goAML-style XML for an STR/SAR: report, reporting entity,
     * subject person and activity nodes.
     */
    public function generate(Company $company, ?Customer $customer, array $report): string
    {
        $doc = $customer
            ? CustomerDocument::withoutGlobalScopes()->where('customer_id', $customer->id)->orderByDesc('verified')->first()
            : null;

        $lines = [];
        $lines[] = '<?xml version="1.0" encoding="UTF-8"?>';
        $lines[] = '<report>';
        $lines[] = '  <rentity_id>'.$this->e($company->trade_license_no).'</rentity_id>';
        $lines[] = '  <rentity_branch>'.$this->e($company->city).'</rentity_branch>';
        $lines[] = '  <submission_code>E</submission_code>';
        $lines[] = '  <report_code>'.$this->e($report['report_type'] ?? 'STR').'</report_code>';
        $lines[] = '  <report_no>'.$this->e($report['report_no'] ?? '').'</report_no>';
        $lines[] = '  <submission_date>'.$this->e(now()->format('Y-m-d\TH:i:s')).'</submission_date>';
        $lines[] = '  <reporting_person>';
        $lines[] = '    <name>'.$this->e($company->name).'</name>';
        $lines[] = '    <sector>'.$this->e($company->sector).'</sector>';
        $lines[] = '    <country>'.$this->e($company->country).'</country>';
        $lines[] = '  </reporting_person>';
        if ($customer) {
            $lines[] = '  <subject>';
            $lines[] = '    <customer_no>'.$this->e($customer->customer_no).'</customer_no>';
            $lines[] = '    <full_name>'.$this->e($customer->full_name).'</full_name>';
            if ($customer->dob) $lines[] = '    <birth_date>'.$customer->dob->format('Y-m-d').'</birth_date>';
            if ($customer->nationality) $lines[] = '    <nationality>'.$this->e($customer->nationality).'</nationality>';
            if ($customer->country) $lines[] = '    <residence_country>'.$this->e($customer->country).'</residence_country>';
            if ($doc) {
                $lines[] = '    <identification>';
                $lines[] = '      <type>'.$this->e($doc->doc_type).'</type>';
                $lines[] = '      <number>'.$this->e($doc->doc_number).'</number>';
                if ($doc->issuing_country) $lines[] = '      <issued_by>'.$this->e($doc->issuing_country).'</issued_by>';
                if ($doc->expiry_date) $lines[] = '      <expiry_date>'.$doc->expiry_date->format('Y-m-d').'</expiry_date>';
                $lines[] = '    </identification>';
            }
            $lines[] = '  </subject>';
        }
        $lines[] = '  <activity>';
        $lines[] = '    <amount_involved>'.$this->e(number_format((float) ($report['amount_involved'] ?? 0), 2, '.', '')).'</amount_involved>';
        $lines[] = '    <currency>AED</currency>';
        $lines[] = '    <reason>'.$this->e($report['reason'] ?? '').'</reason>';
        $lines[] = '    <narrative>'.$this->e($report['narrative'] ?? '').'</narrative>';
        $lines[] = '  </activity>';
        $lines[] = '</report>';

        return implode("\n", $lines);
    }
}
