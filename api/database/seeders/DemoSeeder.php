<?php

namespace Database\Seeders;

use App\Models\AmlCase;
use App\Models\ApiUsage;
use App\Models\Company;
use App\Models\Customer;
use App\Models\FormField;
use App\Models\RiskAssessment;
use App\Models\ScreeningAlert;
use App\Models\ScreeningProvider;
use App\Models\TmAlert;
use App\Models\TmRule;
use App\Models\Transaction;
use App\Models\User;
use App\Models\WatchlistEntry;
use App\Services\AuditLogger;
use App\Services\RiskService;
use App\Services\ScreeningService;
use App\Services\StrService;
use App\Services\TransactionMonitor;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $screeningSvc = app(ScreeningService::class);
        $riskSvc = app(RiskService::class);
        $monitor = app(TransactionMonitor::class);
        $strSvc = app(StrService::class);

        /* ---------------- Companies & users ---------------- */

        $alnoor = Company::create([
            'name' => 'Al Noor Gold & Jewellery LLC',
            'trade_license_no' => 'DED-1188342',
            'sector' => 'jewellery',
            'country' => 'UAE',
            'city' => 'Dubai',
            'phone' => '+971 4 235 8890',
            'email' => 'compliance@alnoor-gold.example',
            'plan' => 'growth',
            'plan_expires_at' => now()->addMonths(6),
            'screening_credits_used' => 6,
            'status' => 'active',
        ]);

        $palm = Company::create([
            'name' => 'Palm Gate Real Estate LLC',
            'trade_license_no' => 'DED-1204471',
            'sector' => 'real_estate',
            'country' => 'UAE',
            'city' => 'Dubai',
            'phone' => '+971 4 552 0134',
            'email' => 'office@palmgate.example',
            'plan' => 'starter',
            'plan_expires_at' => now()->addMonths(3),
            'screening_credits_used' => 0,
            'status' => 'active',
        ]);

        $owner = User::create(['company_id' => $alnoor->id, 'name' => 'Ahmed Al Mansoori', 'email' => 'owner@alnoor.example', 'password' => 'password', 'role' => 'owner', 'phone' => '+971 50 214 8890']);
        $mlro = User::create(['company_id' => $alnoor->id, 'name' => 'Sara Iqbal', 'email' => 'mlro@alnoor.example', 'password' => 'password', 'role' => 'mlro', 'phone' => '+971 52 907 3318']);
        $officer = User::create(['company_id' => $alnoor->id, 'name' => 'Omar Farouk', 'email' => 'officer@alnoor.example', 'password' => 'password', 'role' => 'officer', 'phone' => '+971 55 642 7710']);
        $palmOwner = User::create(['company_id' => $palm->id, 'name' => 'Layla Haddad', 'email' => 'owner@palmgate.example', 'password' => 'password', 'role' => 'owner', 'phone' => '+971 50 881 2045']);

        /* ---------------- Watchlist (global) ---------------- */

        foreach ($this->watchlist() as $entry) {
            WatchlistEntry::create($entry);
        }

        /* ---------------- Providers, TM rules, form fields ---------------- */

        foreach ([$alnoor, $palm] as $company) {
            $this->seedProviders($company);
            $this->seedTmRules($company->id);
            $this->seedFormFields($company->id);
        }

        ApiUsage::create([
            'company_id' => $alnoor->id, 'provider' => 'opensanctions',
            'calls' => 6, 'credits' => 6, 'month' => now()->format('Y-m'), 'source' => 'Test screening',
        ]);

        /* ---------------- Al Noor customers ---------------- */

        $customers = [];
        foreach ($this->alnoorCustomers() as $def) {
            $doc = $def['doc'] ?? null;
            unset($def['doc']);
            $customer = Customer::create(array_merge($def, [
                'company_id' => $alnoor->id,
                'customer_no' => Customer::nextNumber($alnoor->id),
                'created_by' => $officer->id,
            ]));
            if ($doc) {
                $state = $doc['checklist_state'] ?? 'pending';
                unset($doc['checklist_state']);
                $customer->documents()->create(array_merge($doc, [
                    'company_id' => $alnoor->id,
                    'verification' => $this->checklist($state),
                    'verified' => $state === 'verified',
                    'verified_by' => $state === 'verified' ? $officer->id : null,
                    'verified_at' => $state === 'verified' ? now()->subDays(2) : null,
                ]));
            }
            $customers[$customer->full_name] = $customer;
        }

        // Screen every Al Noor customer (auto screening on onboarding).
        foreach ($customers as $customer) {
            $screeningSvc->performScreening($alnoor, [
                'name' => $customer->full_name,
                'name_ar' => $customer->name_ar,
                'dob' => $customer->dob?->format('Y-m-d'),
                'nationality' => $customer->nationality,
            ], $officer->id, ['source' => 'auto', 'customer' => $customer]);
        }

        // Risk scoring after screening (alerts feed the score).
        foreach ($customers as $customer) {
            $riskSvc->recompute($customer->fresh());
        }

        // Confirmed matches -> restricted (decided by the MLRO).
        foreach (['Omar Hassan Mahmoud', 'Tariq Aziz Rahman'] as $name) {
            $customer = $customers[$name]->fresh();
            $alert = ScreeningAlert::withoutGlobalScopes()
                ->where('customer_id', $customer->id)
                ->orderByDesc('match_score')
                ->first();
            if ($alert) {
                $alert->update([
                    'status' => 'confirmed_match',
                    'decided_by' => $mlro->id,
                    'decided_at' => now()->subDays(2),
                    'decision_notes' => 'Confirmed true match after document comparison by MLRO. Customer restricted; no further transactions permitted.',
                ]);
                AuditLogger::log('alert.decided', $alnoor->id, $mlro->id, 'screening_alert', $alert->id, ['decision' => 'confirm_match']);
            }
            $customer->update(['screening_status' => 'confirmed_match', 'status' => 'restricted']);
        }

        // Approved / active customers.
        foreach (['Salim Al Falasi', 'Mariam Khalid Al Suwaidi', 'Priya Nair', 'Mohamed El Sayed', 'Khalid Al Amiri', 'Peter Mwangi'] as $name) {
            $customers[$name]->update([
                'kyc_status' => 'approved',
                'status' => 'active',
                'next_review_date' => now()->addYear()->toDateString(),
            ]);
        }
        // One rejected, one archived.
        $customers['Sunita Sharma']->update(['kyc_status' => 'rejected', 'status' => 'rejected']);
        $customers['Deepak Verma']->update(['status' => 'archived']);

        // A few open alerts become overdue for the dashboard.
        ScreeningAlert::withoutGlobalScopes()
            ->where('company_id', $alnoor->id)
            ->whereIn('status', ['open', 'under_review'])
            ->orderBy('id')
            ->limit(3)
            ->get()
            ->each(fn ($a) => $a->update(['due_at' => now()->subDays(2), 'created_at' => now()->subDays(6)]));

        /* ---------------- Transactions (through the monitor) ---------------- */

        $txnDefs = $this->transactions();
        // Chronological order so window-based rules evaluate realistically.
        usort($txnDefs, fn ($a, $b) => $b['days_ago'] <=> $a['days_ago']);
        foreach ($txnDefs as $def) {
            $customer = $customers[$def['customer']] ?? null;
            if (!$customer) continue;
            $txn = Transaction::create([
                'company_id' => $alnoor->id,
                'customer_id' => $customer->id,
                'txn_no' => Transaction::nextNumber($alnoor->id),
                'txn_date' => now()->subDays($def['days_ago'])->toDateString(),
                'type' => $def['type'] ?? 'buy',
                'item_description' => $def['desc'],
                'metal_type' => $def['metal'] ?? 'gold',
                'weight_grams' => $def['weight'] ?? null,
                'amount' => $def['amount'],
                'currency' => 'AED',
                'payment_method' => $def['method'],
                'channel' => 'counter',
                'status' => 'completed',
                'created_by' => $officer->id,
            ]);
            $monitor->runForTransaction($alnoor, $txn);
        }

        /* ---------------- Cases & STR ---------------- */

        // Case 1: structuring by Imran Sheikh, escalated from the TM alert.
        $imran = $customers['Imran Sheikh'];
        $structAlert = TmAlert::withoutGlobalScopes()
            ->where('company_id', $alnoor->id)
            ->where('customer_id', $imran->id)
            ->where('rule_code', 'STRUCTURING')
            ->first();

        $case1 = AmlCase::create([
            'company_id' => $alnoor->id,
            'case_no' => AmlCase::nextNumber($alnoor->id),
            'customer_id' => $imran->id,
            'source' => 'transaction',
            'title' => 'Possible structuring — split cash purchases',
            'description' => 'Customer made three cash purchases of AED 19,500 each within five days, each below the AED 55,000 reporting threshold. Escalated from transaction monitoring for MLRO review.',
            'status' => 'investigating',
            'priority' => 'high',
            'assigned_to' => $mlro->id,
            'opened_by' => $owner->id,
            'due_at' => now()->addDays(3),
        ]);
        if ($structAlert) {
            $structAlert->update(['status' => 'escalated_to_case', 'decided_by' => $owner->id, 'decided_at' => now()->subDay()]);
        }
        AuditLogger::log('case.created', $alnoor->id, $owner->id, 'case', $case1->id, ['source' => 'transaction']);

        // STR draft linked to case 1.
        $strSvc->createDraft($case1, $mlro->id);

        // Case 2: Aneesh Doshi screening match, escalated, pending MLRO.
        $aneesh = $customers['Aneesh Doshi'];
        $screenAlert = ScreeningAlert::withoutGlobalScopes()
            ->where('company_id', $alnoor->id)
            ->where('customer_id', $aneesh->id)
            ->orderByDesc('match_score')
            ->first();
        $case2 = AmlCase::create([
            'company_id' => $alnoor->id,
            'case_no' => AmlCase::nextNumber($alnoor->id),
            'customer_id' => $aneesh->id,
            'source' => 'screening',
            'title' => 'Screening match review — Aneesh Doshi',
            'description' => 'Near-exact name and date-of-birth match against a US exclusions entry (Anish B Doshi). Awaiting MLRO determination of true match vs. false positive.',
            'status' => 'pending_mlro',
            'priority' => 'high',
            'assigned_to' => $mlro->id,
            'opened_by' => $officer->id,
            'due_at' => now()->addDays(2),
        ]);
        if ($screenAlert && $screenAlert->status === 'open') {
            $screenAlert->update(['status' => 'escalated', 'decided_by' => $officer->id, 'decided_at' => now()->subHours(5)]);
        }
        AuditLogger::log('case.created', $alnoor->id, $officer->id, 'case', $case2->id, ['source' => 'screening']);

        /* ---------------- EWRA ---------------- */

        RiskAssessment::create([
            'company_id' => $alnoor->id,
            'title' => 'EWRA 2026 — Annual Enterprise-Wide Risk Assessment',
            'period' => '2026',
            'status' => 'draft',
            'customer_score' => 65,
            'products_score' => 70,
            'channels_score' => 40,
            'geography_score' => 55,
            'counterparty_score' => 50,
            'inherent_score' => 56,
            'residual_score' => 34,
            'methodology_note' => 'Scored under the group EWRA methodology v2.1: inherent risk is the mean of the five risk dimensions; residual risk applies a 40% control-effectiveness reduction based on screening coverage, transaction monitoring rules and MLRO review cadence. To be signed off by the Compliance Officer, MLRO and Board.',
            'created_by' => $owner->id,
        ]);

        /* ---------------- Palm Gate (second tenant) ---------------- */

        $palmDefs = [
            ['full_name' => 'Daniel Whitfield', 'first_name' => 'Daniel', 'last_name' => 'Whitfield', 'dob' => '1984-03-12', 'nationality' => 'United Kingdom', 'residency' => 'non_resident', 'member_category' => 'regular', 'occupation' => 'Investor', 'expected_activity' => 'Property purchases via bank transfer', 'email' => 'daniel.w@example.com', 'phone' => '+44 7700 900112', 'city' => 'Dubai', 'country' => 'UAE'],
            ['full_name' => 'Aisha Rahman', 'first_name' => 'Aisha', 'last_name' => 'Rahman', 'dob' => '1991-07-19', 'nationality' => 'UAE', 'residency' => 'resident', 'member_category' => 'walk_in', 'occupation' => 'Architect', 'expected_activity' => 'First home purchase', 'email' => 'aisha.r@example.com', 'phone' => '+971 50 334 7712', 'city' => 'Dubai', 'country' => 'UAE'],
            ['full_name' => 'George Haddad', 'first_name' => 'George', 'last_name' => 'Haddad', 'dob' => '1978-11-02', 'nationality' => 'Lebanon', 'residency' => 'gcc', 'member_category' => 'vip', 'occupation' => 'Business owner', 'expected_activity' => 'High value property investments', 'email' => 'george.h@example.com', 'phone' => '+971 55 908 4417', 'city' => 'Dubai', 'country' => 'UAE'],
        ];
        foreach ($palmDefs as $def) {
            $c = Customer::create(array_merge($def, [
                'company_id' => $palm->id,
                'customer_no' => Customer::nextNumber($palm->id),
                'created_by' => $palmOwner->id,
            ]));
            $screeningSvc->performScreening($palm, [
                'name' => $c->full_name, 'dob' => $def['dob'], 'nationality' => $def['nationality'],
            ], $palmOwner->id, ['source' => 'auto', 'customer' => $c]);
            $riskSvc->recompute($c->fresh());
        }
    }

    /* ================= helpers ================= */

    private function checklist(string $state): array
    {
        $keys = ['clarity', 'all_sides', 'number_matches', 'dates_valid', 'details_match', 'authenticity'];
        $out = [];
        foreach ($keys as $i => $k) {
            $out[$k] = match ($state) {
                'verified' => 'verified',
                'partial' => $i < 3 ? 'verified' : 'pending',
                default => 'pending',
            };
        }
        return $out;
    }

    private function seedProviders(Company $company): void
    {
        $rows = [
            ['provider' => 'opensanctions', 'is_enabled' => true, 'mode' => 'realtime', 'threshold' => 0.70, 'logic' => 'v2', 'sync_schedule' => 'Daily', 'status_text' => 'Local fallback active — add an API key for live OpenSanctions data'],
            ['provider' => 'ofac', 'is_enabled' => true, 'mode' => 'loaded', 'sync_schedule' => 'Every 6 hours', 'last_sync_at' => now()->subHours(2), 'status_text' => 'Loaded'],
            ['provider' => 'eu', 'is_enabled' => true, 'mode' => 'loaded', 'sync_schedule' => 'Every 6 hours', 'last_sync_at' => now()->subHours(3), 'status_text' => 'Loaded'],
            ['provider' => 'un', 'is_enabled' => true, 'mode' => 'loaded', 'sync_schedule' => 'Every 6 hours', 'last_sync_at' => now()->subHours(3), 'status_text' => 'Loaded'],
            ['provider' => 'uk', 'is_enabled' => true, 'mode' => 'loaded', 'sync_schedule' => 'Every 6 hours', 'last_sync_at' => now()->subHours(4), 'status_text' => 'Loaded'],
            ['provider' => 'dowjones', 'is_enabled' => false, 'mode' => 'file', 'sync_schedule' => 'Every 6 hours', 'status_text' => 'Requires your own subscription'],
        ];
        foreach ($rows as $row) {
            ScreeningProvider::create(array_merge($row, ['company_id' => $company->id]));
        }
    }

    private function seedTmRules(int $companyId): void
    {
        $rules = [
            ['code' => 'CASH_THRESHOLD', 'name' => 'Cash threshold reporting', 'description' => 'Single cash transaction at or above the reporting threshold.', 'params' => ['threshold' => 55000], 'severity' => 'high'],
            ['code' => 'STRUCTURING', 'name' => 'Structuring detection', 'description' => 'Multiple cash transactions just below the threshold within a short window.', 'params' => ['count' => 3, 'days' => 7, 'threshold' => 55000], 'severity' => 'high'],
            ['code' => 'HIGH_VALUE', 'name' => 'High-value transaction', 'description' => 'Any single transaction at or above the high-value threshold.', 'params' => ['threshold' => 200000], 'severity' => 'medium'],
            ['code' => 'RAPID_SUCCESSION', 'name' => 'Rapid succession', 'description' => 'Unusually many transactions by one customer in a single day.', 'params' => ['count' => 5, 'hours' => 24], 'severity' => 'medium'],
            ['code' => 'HIGH_RISK_CUSTOMER', 'name' => 'High-risk customer activity', 'description' => 'Any transaction by a customer rated high or severe risk.', 'params' => new \stdClass(), 'severity' => 'medium'],
            ['code' => 'DORMANT_SPIKE', 'name' => 'Dormant account spike', 'description' => 'Large transaction after a long period without activity.', 'params' => ['days' => 90, 'threshold' => 100000], 'severity' => 'low'],
        ];
        foreach ($rules as $rule) {
            TmRule::create(array_merge($rule, ['company_id' => $companyId, 'is_enabled' => true]));
        }
    }

    private function seedFormFields(int $companyId): void
    {
        $fields = [
            ['member_category', 'Member category', 'Customer classification', false, 1],
            ['residency', 'Residency type', 'Customer classification', true, 2],
            ['full_name', 'Full name', 'Personal information', true, 3],
            ['first_name', 'First name', 'Personal information', false, 4],
            ['middle_name', 'Middle name', 'Personal information', false, 5],
            ['last_name', 'Last name', 'Personal information', false, 6],
            ['name_ar', 'Name (Arabic)', 'Personal information', false, 7],
            ['dob', 'Date of birth', 'Personal information', true, 8],
            ['nationality', 'Nationality', 'Personal information', true, 9],
            ['gender', 'Gender', 'Personal information', false, 10],
            ['occupation', 'Occupation', 'Personal information', false, 11],
            ['employer', 'Employer', 'Personal information', false, 12],
            ['email', 'Email', 'Contact & address', false, 13],
            ['phone', 'Mobile number', 'Contact & address', true, 14],
            ['whatsapp', 'WhatsApp', 'Contact & address', false, 15],
            ['address_line', 'Address', 'Contact & address', false, 16],
            ['city', 'City', 'Contact & address', false, 17],
            ['country', 'Country', 'Contact & address', false, 18],
            ['source_of_funds', 'Source of funds', 'Compliance', true, 19],
            ['expected_activity', 'Expected activity', 'Compliance', false, 20],
        ];
        foreach ($fields as [$key, $label, $section, $mandatory, $sort]) {
            FormField::create([
                'company_id' => $companyId, 'field_key' => $key, 'label' => $label,
                'section' => $section, 'is_mandatory' => $mandatory, 'is_enabled' => true, 'sort' => $sort,
            ]);
        }
    }

    /* ================= seed data ================= */

    private function watchlist(): array
    {
        $p = fn (string $list, string $name, ?string $dob, ?string $nat, array $aliases, array $programmes, string $summary, ?string $ar = null) => [
            'source_list' => $list, 'full_name' => $name, 'dob' => $dob, 'nationality' => $nat,
            'aliases' => $aliases, 'programmes' => $programmes, 'summary' => $summary,
            'entity_type' => 'person', 'name_ar' => $ar, 'is_active' => true,
        ];
        $c = fn (string $list, string $name, ?string $nat, array $programmes, string $summary) => [
            'source_list' => $list, 'full_name' => $name, 'dob' => null, 'nationality' => $nat,
            'aliases' => [], 'programmes' => $programmes, 'summary' => $summary,
            'entity_type' => 'company', 'name_ar' => null, 'is_active' => true,
        ];

        return [
            $p('UN Security Council', 'Osama bin Laden', '1957-03-10', 'Saudi Arabia', ['Usama bin Laden', 'Shaykh Osama bin Laden', 'Abu Abdullah'], ['Al-Qaida', 'Taliban'], 'Founder of Al-Qaida. Listed by the UN Security Council ISIL/Al-Qaida sanctions committee.', 'أسامة بن لادن'),
            $p('OFAC SDN', 'Osama bin Laden', '1957-03-10', 'Saudi Arabia', ['Usama bin Laden'], ['SDGT'], 'Specially Designated Global Terrorist (historical entry retained for screening tests).'),
            $p('PEP Database', 'Vladimir Putin', '1952-10-07', 'Russia', ['Vladimir Vladimirovich Putin'], ['PEP — Head of State'], 'President of the Russian Federation. Politically exposed person; sanctioned by multiple jurisdictions.'),
            $p('EU Consolidated', 'Vladimir Putin', '1952-10-07', 'Russia', ['Vladimir Vladimirovich Putin'], ['EU Russia sanctions'], 'Listed under EU restrictive measures in response to the war against Ukraine.'),
            $p('EU Consolidated', 'Bashar al-Assad', '1965-09-11', 'Syria', ['Bashar Hafez al-Assad'], ['EU Syria sanctions'], 'Former president of Syria, listed under EU Syria restrictive measures.'),
            $p('UN Security Council', 'Kim Jong-un', '1984-01-08', 'North Korea', ['Kim Jong Un', 'Kim Jung-un'], ['DPRK sanctions'], 'Supreme Leader of North Korea, listed under UN DPRK sanctions.'),
            $p('OFAC SDN', 'Nicolas Maduro', '1962-11-23', 'Venezuela', ['Nicolas Maduro Moros'], ['Venezuela sanctions'], 'Specially Designated National under the Venezuela sanctions programme.'),
            $p('EU Consolidated', 'Yahya Sinwar', '1962-10-29', 'Palestine', ['Yehya Sinwar', 'Yehia Ibrahim Hassan Sinwar'], ['EU terrorist list'], 'Former Hamas leader, listed on the EU terrorist list (historical).'),
            $p('OFAC SDN', 'Hassan Nasrallah', '1960-08-31', 'Lebanon', ['Sayyed Hassan Nasrallah'], ['SDGT'], 'Former secretary-general of Hizballah, designated under US counter-terrorism authorities (historical).'),
            $p('UN Security Council', 'Ayman al-Zawahiri', '1951-06-19', 'Egypt', ['Ayman Muhammad Rabi al-Zawahiri'], ['Al-Qaida'], 'Former leader of Al-Qaida, listed by the UN ISIL/Al-Qaida committee (historical).'),
            $p('UN Security Council', 'Abu Bakr al-Baghdadi', '1971-07-28', 'Iraq', ['Ibrahim Awad Ibrahim al-Badri'], ['ISIL'], 'Former leader of ISIL, listed by the UN Security Council (historical).'),
            $p('UK Sanctions', 'Dmitry Volkov', '1978-05-14', 'Russia', ['Dmitri Volkov'], ['UK Russia sanctions'], 'Designated under the UK Russia sanctions regime for supporting destabilising activities.'),
            $p('OFAC SDN', 'Viktor Petrov', '1975-02-02', 'Russia', ['Victor Petrov'], ['Russia/Ukraine sanctions'], 'Specially Designated National linked to procurement networks for dual-use goods.'),
            $p('EU Consolidated', 'Sergei Ivanov', '1980-11-30', 'Russia', ['Sergey Ivanov'], ['EU Russia sanctions'], 'Listed under EU restrictive measures relating to actions undermining Ukraine.'),
            $p('EU Consolidated', 'Alexander Lukashenko', '1954-08-30', 'Belarus', ['Aliaksandr Lukashenko'], ['EU Belarus sanctions', 'PEP — Head of State'], 'President of Belarus, listed under EU Belarus restrictive measures.'),
            $p('UK Sanctions', 'Min Aung Hlaing', '1956-07-03', 'Myanmar', [], ['UK Myanmar sanctions'], 'Commander-in-Chief of Myanmar armed forces, designated under UK Myanmar sanctions.'),
            $p('OFAC SDN', 'Ebrahim Raisi', '1960-12-14', 'Iran', ['Ebrahim Raeisi'], ['Iran sanctions'], 'Former president of Iran, designated under US Iran authorities (historical).'),
            $p('US Exclusions', 'Anish B Doshi', '1972-08-20', 'United States', ['Anish Doshi'], ['US-HHS-OIG exclusions', 'SAM exclusions'], 'Physician excluded from US federal healthcare programmes; appears on SAM and HHS-OIG exclusion lists.'),
            $p('Interpol Red Notices', 'Rajesh Kumar Malhotra', '1985-06-22', 'India', ['Rajesh Malhotra'], ['Fraud — wanted'], 'Wanted for large-scale investment fraud and money laundering offences.'),
            $p('OFAC SDN', 'Chen Wei', '1988-09-09', 'China', [], ['Cyber sanctions'], 'Designated for involvement in state-linked cyber intrusions.'),
            $p('EU Consolidated', 'Li Na', '1990-01-15', 'China', [], ['EU cyber sanctions'], 'Listed under EU cyber sanctions for malicious cyber activities.'),
            $p('PEP Database', 'Fatima Al Zahra Karim', '1982-04-17', 'Lebanon', ['Fatima Karim'], ['PEP — senior official family'], 'Close family member of a senior public official; classified as a politically exposed person.'),
            $p('PEP Database', 'Khalid Al Mansour', '1979-12-01', 'Yemen', [], ['PEP — state enterprise'], 'Former chairman of a state-owned enterprise; politically exposed person.'),
            $p('UK Sanctions', 'Igor Sokolov', '1983-07-25', 'Russia', [], ['UK Russia sanctions'], 'Designated under the UK Russia sanctions regime.'),
            $p('EU Consolidated', 'Andrei Kozlov', '1977-03-19', 'Belarus', [], ['EU Belarus sanctions'], 'Listed under EU Belarus restrictive measures.'),
            $p('UAE Terrorist List', 'Omar Hassan Mahmoud', '1988-03-02', 'Egypt', ['Omar Mahmoud'], ['UAE national terrorist list'], 'Named on the UAE national list of designated terrorist persons.'),
            $p('UN Security Council', 'Tariq Aziz Rahman', '1969-08-23', 'Afghanistan', ['Tariq Rahman'], ['Taliban'], 'Listed by the UN Security Council Taliban sanctions committee for financing activities.'),
            $p('EU Consolidated', 'Mohammed Deif', '1965-08-12', 'Palestine', ['Mohammad Deif', 'Mohammed Diab Ibrahim al-Masri'], ['EU terrorist list'], 'Former Hamas military commander, listed on the EU terrorist list (historical).'),
            $p('OFAC SDN', 'Ismail Haniyeh', '1962-01-29', 'Palestine', ['Ismail Abdel Salam Haniyeh'], ['SDGT'], 'Former Hamas political leader, designated under US counter-terrorism authorities (historical).'),
            $p('OFAC SDN', 'Qasem Soleimani', '1957-03-11', 'Iran', ['Qassem Soleimani'], ['SDGT', 'IRGC'], 'Former commander of the IRGC Quds Force, designated under US authorities (historical).'),
            $p('OFAC SDN', 'Ramzan Kadyrov', '1976-10-05', 'Russia', ['Ramzan Akhmadovich Kadyrov'], ['Magnitsky sanctions'], 'Head of the Chechen Republic, designated under the Global Magnitsky programme.'),
            $p('UK Sanctions', 'Yevgeny Prigozhin', '1961-06-01', 'Russia', ['Evgeny Prigozhin'], ['UK Russia sanctions'], 'Former head of the Wagner Group, designated under UK sanctions (historical).'),
            $p('OFAC SDN', 'Pablo Escobar', '1949-12-01', 'Colombia', ['Pablo Emilio Escobar Gaviria'], ['Narcotics — Kingpin Act'], 'Historical narcotics kingpin entry retained on legacy screening lists.'),
            $p('OFAC SDN', 'Joaquin Guzman Loera', '1957-04-04', 'Mexico', ['El Chapo', 'Joaquin Archivaldo Guzman Loera'], ['Narcotics — Kingpin Act'], 'Former Sinaloa cartel leader, designated under the Kingpin Act.'),
            $p('UN Security Council', 'Dawood Ibrahim', '1955-12-26', 'India', ['Dawood Ibrahim Kaskar'], ['Al-Qaida'], 'Listed by the UN ISIL/Al-Qaida committee; wanted for organised crime and terror financing.'),
            $p('UN Security Council', 'Hafiz Saeed', '1950-06-05', 'Pakistan', ['Hafiz Muhammad Saeed'], ['Al-Qaida'], 'Founder of Lashkar-e-Taiba, listed by the UN Security Council.'),
            $p('UN Security Council', 'Zaki-ur-Rehman Lakhvi', '1960-12-30', 'Pakistan', ['Zaki Ur Rehman Lakhvi'], ['Al-Qaida'], 'Listed by the UN ISIL/Al-Qaida committee in connection with Lashkar-e-Taiba.'),
            $p('OFAC SDN', 'Viktor Bout', '1967-01-13', 'Russia', ['Victor Bout'], ['Arms trafficking'], 'Designated arms dealer, sanctioned under multiple programmes.'),
            $p('Interpol Red Notices', 'Semion Mogilevich', '1946-06-30', 'Ukraine', ['Seva Mogilevich'], ['Organised crime — wanted'], 'Wanted for organised crime, fraud and money laundering offences.'),
            $p('Interpol Red Notices', 'Jho Low', '1981-11-04', 'Malaysia', ['Low Taek Jho'], ['1MDB — wanted'], 'Wanted in connection with the 1MDB fraud and money laundering investigation.'),
            $p('Interpol Red Notices', 'Ruja Ignatova', '1980-05-30', 'Bulgaria', ['Dr Ruja'], ['OneCoin — wanted'], 'Wanted for the OneCoin cryptocurrency fraud scheme.'),
            $c('OFAC SDN', 'Nordwind Trading LLC', 'Russia', ['Russia/Ukraine sanctions'], 'Designated trading company used to route sanctioned goods.'),
            $c('UAE Terrorist List', 'Crescent Exchange Co', 'UAE', ['UAE national terrorist list'], 'Money services business named on the UAE national terrorist list.'),
            $c('EU Consolidated', 'Golden Falcon Trading FZE', 'UAE', ['EU Russia sanctions'], 'Free-zone trading company listed for sanctions circumvention.'),
            $c('UK Sanctions', 'Baltic Shipping Ltd', 'Russia', ['UK Russia sanctions'], 'Shipping company designated under the UK Russia sanctions regime.'),
            $c('UN Security Council', 'Sahara Gold Refinery Ltd', 'Sudan', ['Sudan sanctions'], 'Listed in connection with conflict gold trade and sanctions violations.'),
            $c('OFAC SDN', 'Volkov Holdings Ltd', 'Russia', ['Russia/Ukraine sanctions'], 'Holding company designated as part of a sanctioned procurement network.'),
        ];
    }

    private function alnoorCustomers(): array
    {
        $base = ['type' => 'individual', 'city' => 'Dubai', 'country' => 'UAE'];
        $doc = fn (string $type, string $no, ?string $issue, ?string $expiry, string $state, ?string $country = 'UAE') => [
            'doc_type' => $type, 'doc_number' => $no, 'issuing_country' => $country,
            'issue_date' => $issue, 'expiry_date' => $expiry, 'file_name' => strtolower($type).'_scan.pdf',
            'checklist_state' => $state,
        ];

        return [
            array_merge($base, ['full_name' => 'Jamal Khaled Muhammad Hussein Al-Taie', 'first_name' => 'Jamal', 'middle_name' => 'Khaled Muhammad Hussein', 'last_name' => 'Al-Taie', 'name_ar' => 'جمال خالد محمد حسين الطائي', 'dob' => '1990-05-11', 'nationality' => 'Iraq', 'residency' => 'resident', 'member_category' => 'walk_in', 'occupation' => 'Trader', 'source_of_funds' => 'Business income', 'expected_activity' => 'Occasional cash purchases of gold jewellery', 'phone' => '+971 50 781 2234', 'email' => 'jamal.taie@example.com',
                'doc' => $doc('emirates_id', '784-1990-1234555-1', '2026-11-05', '2028-11-05', 'pending')]),
            array_merge($base, ['full_name' => 'Aneesh Doshi', 'first_name' => 'Aneesh', 'last_name' => 'Doshi', 'dob' => '1972-08-20', 'nationality' => 'India', 'residency' => 'non_resident', 'member_category' => 'walk_in', 'occupation' => 'Doctor', 'source_of_funds' => 'Professional income', 'expected_activity' => 'Investment purchase of gold bars', 'phone' => '+91 98200 41176', 'email' => 'aneesh.doshi@example.com',
                'doc' => $doc('passport', 'N4829917', '2019-06-14', '2029-06-13', 'partial', 'India')]),
            array_merge($base, ['full_name' => 'Vladimir Petrov', 'first_name' => 'Vladimir', 'last_name' => 'Petrov', 'dob' => '1977-06-15', 'nationality' => 'Russia', 'residency' => 'non_resident', 'member_category' => 'walk_in', 'occupation' => 'Businessman', 'source_of_funds' => 'Business income', 'expected_activity' => 'High value purchases by bank transfer', 'phone' => '+7 916 220 4315', 'email' => 'v.petrov@example.com',
                'doc' => $doc('passport', '721455890', '2021-02-01', '2031-01-31', 'pending', 'Russia')]),
            array_merge($base, ['full_name' => 'Omar Hassan Mahmoud', 'first_name' => 'Omar', 'middle_name' => 'Hassan', 'last_name' => 'Mahmoud', 'dob' => '1988-03-02', 'nationality' => 'Egypt', 'residency' => 'resident', 'member_category' => 'walk_in', 'occupation' => 'Driver', 'source_of_funds' => 'Salary', 'expected_activity' => 'Occasional gold purchases', 'phone' => '+971 56 330 9812', 'email' => 'omar.hm@example.com',
                'doc' => $doc('emirates_id', '784-1988-7712045-3', '2024-05-20', '2026-05-19', 'partial')]),
            array_merge($base, ['full_name' => 'Tariq Aziz Rahman', 'first_name' => 'Tariq', 'middle_name' => 'Aziz', 'last_name' => 'Rahman', 'dob' => '1969-08-23', 'nationality' => 'Afghanistan', 'residency' => 'non_resident', 'member_category' => 'walk_in', 'occupation' => 'Merchant', 'source_of_funds' => 'Trading income', 'expected_activity' => 'Cash purchases of gold', 'phone' => '+93 700 221 908', 'email' => 'tariq.rahman@example.com',
                'doc' => $doc('passport', 'P00981234', '2018-09-01', '2023-08-31', 'pending', 'Afghanistan')]),
            array_merge($base, ['full_name' => 'Salim Al Falasi', 'first_name' => 'Salim', 'last_name' => 'Al Falasi', 'dob' => '1985-01-19', 'nationality' => 'UAE', 'residency' => 'resident', 'member_category' => 'vip', 'occupation' => 'Real estate investor', 'source_of_funds' => 'Investment income', 'expected_activity' => 'Regular investment purchases of gold bars', 'phone' => '+971 50 614 2908', 'email' => 'salim.alfalasi@example.com',
                'doc' => $doc('emirates_id', '784-1985-3099812-1', '2023-03-11', '2027-03-10', 'verified')]),
            array_merge($base, ['full_name' => 'Mariam Khalid Al Suwaidi', 'first_name' => 'Mariam', 'middle_name' => 'Khalid', 'last_name' => 'Al Suwaidi', 'dob' => '1992-09-27', 'nationality' => 'UAE', 'residency' => 'resident', 'member_category' => 'regular', 'occupation' => 'Banker', 'source_of_funds' => 'Salary and savings', 'expected_activity' => 'Jewellery purchases on occasions', 'phone' => '+971 52 781 3409', 'email' => 'mariam.alsuwaidi@example.com',
                'doc' => $doc('emirates_id', '784-1992-6550218-2', '2024-01-15', '2028-01-14', 'verified')]),
            array_merge($base, ['full_name' => 'Priya Nair', 'first_name' => 'Priya', 'last_name' => 'Nair', 'dob' => '1990-12-03', 'nationality' => 'India', 'residency' => 'resident', 'member_category' => 'regular', 'occupation' => 'Software engineer', 'source_of_funds' => 'Salary', 'expected_activity' => 'Festive gold and diamond purchases', 'phone' => '+971 54 209 8871', 'email' => 'priya.nair@example.com',
                'doc' => $doc('passport', 'Z5099214', '2020-08-19', '2030-08-18', 'verified', 'India')]),
            array_merge($base, ['full_name' => 'Rajesh Menon', 'first_name' => 'Rajesh', 'last_name' => 'Menon', 'dob' => '1983-04-14', 'nationality' => 'India', 'residency' => 'resident', 'member_category' => 'walk_in', 'occupation' => 'Sales manager', 'source_of_funds' => 'Salary', 'expected_activity' => 'Occasional gold purchases', 'phone' => '+971 50 447 6120', 'email' => 'rajesh.menon@example.com',
                'doc' => $doc('emirates_id', '784-1983-9012774-1', '2022-07-07', '2026-07-06', 'partial')]),
            array_merge($base, ['full_name' => 'Sunita Sharma', 'first_name' => 'Sunita', 'last_name' => 'Sharma', 'dob' => '1988-07-30', 'nationality' => 'India', 'residency' => 'resident', 'member_category' => 'walk_in', 'occupation' => 'Teacher', 'source_of_funds' => 'Salary', 'expected_activity' => 'Small jewellery purchases', 'phone' => '+971 58 190 5523', 'email' => 'sunita.sharma@example.com',
                'doc' => $doc('passport', 'M7712098', '2017-04-02', '2027-04-01', 'pending', 'India')]),
            array_merge($base, ['full_name' => 'Mohamed El Sayed', 'first_name' => 'Mohamed', 'last_name' => 'El Sayed', 'dob' => '1979-11-08', 'nationality' => 'Egypt', 'residency' => 'resident', 'member_category' => 'regular', 'occupation' => 'Accountant', 'source_of_funds' => 'Salary', 'expected_activity' => 'Regular savings in gold coins', 'phone' => '+971 55 812 0094', 'email' => 'mohamed.elsayed@example.com',
                'doc' => $doc('emirates_id', '784-1979-4412098-2', '2023-09-23', '2027-09-22', 'verified')]),
            array_merge($base, ['full_name' => 'Fatima Noor', 'first_name' => 'Fatima', 'last_name' => 'Noor', 'dob' => '1995-02-21', 'nationality' => 'Lebanon', 'residency' => 'resident', 'member_category' => 'walk_in', 'occupation' => 'Designer', 'source_of_funds' => 'Freelance income', 'expected_activity' => 'Occasional jewellery purchases', 'phone' => '+971 50 992 3176', 'email' => 'fatima.noor@example.com',
                'doc' => $doc('passport', 'RL2281098', '2021-12-01', '2031-11-30', 'pending', 'Lebanon')]),
            array_merge($base, ['full_name' => 'Khalid Al Amiri', 'first_name' => 'Khalid', 'last_name' => 'Al Amiri', 'dob' => '1980-06-06', 'nationality' => 'UAE', 'residency' => 'resident', 'member_category' => 'corporate', 'occupation' => 'Company director', 'source_of_funds' => 'Business income', 'expected_activity' => 'Corporate gifting and investment purchases', 'phone' => '+971 50 123 7745', 'email' => 'khalid.alamiri@example.com',
                'doc' => $doc('emirates_id', '784-1980-2087712-1', '2024-02-18', '2028-02-17', 'verified')]),
            array_merge($base, ['full_name' => 'Latifa Al Hashemi', 'first_name' => 'Latifa', 'last_name' => 'Al Hashemi', 'dob' => '1998-10-12', 'nationality' => 'UAE', 'residency' => 'resident', 'member_category' => 'regular', 'occupation' => 'Marketing executive', 'source_of_funds' => 'Salary', 'expected_activity' => 'Bridal jewellery purchases', 'phone' => '+971 56 720 4418', 'email' => 'latifa.alhashemi@example.com',
                'doc' => $doc('emirates_id', '784-1998-7731209-3', '2025-01-05', '2029-01-04', 'partial')]),
            array_merge($base, ['full_name' => 'Deepak Verma', 'first_name' => 'Deepak', 'last_name' => 'Verma', 'dob' => '1975-08-17', 'nationality' => 'India', 'residency' => 'resident', 'member_category' => 'walk_in', 'occupation' => 'Technician', 'source_of_funds' => 'Salary', 'expected_activity' => 'Occasional small purchases', 'phone' => '+971 52 617 2098', 'email' => 'deepak.verma@example.com',
                'doc' => $doc('passport', 'K3098812', '2016-05-25', '2026-05-24', 'pending', 'India')]),
            array_merge($base, ['full_name' => 'Imran Sheikh', 'first_name' => 'Imran', 'last_name' => 'Sheikh', 'dob' => '1987-01-25', 'nationality' => 'Pakistan', 'residency' => 'resident', 'member_category' => 'regular', 'occupation' => 'Trader', 'source_of_funds' => 'Trading income', 'expected_activity' => 'Cash purchases of gold for resale', 'phone' => '+971 55 340 1298', 'email' => 'imran.sheikh@example.com',
                'doc' => $doc('emirates_id', '784-1987-5129083-2', '2023-06-14', '2026-06-13', 'partial')]),
            array_merge($base, ['full_name' => 'Bilal Ahmad', 'first_name' => 'Bilal', 'last_name' => 'Ahmad', 'dob' => '1993-05-09', 'nationality' => 'Pakistan', 'residency' => 'resident', 'member_category' => 'walk_in', 'occupation' => 'Delivery supervisor', 'source_of_funds' => 'Salary', 'expected_activity' => 'Small frequent purchases', 'phone' => '+971 58 271 9034', 'email' => 'bilal.ahmad@example.com',
                'doc' => $doc('passport', 'BR9812770', '2022-03-17', '2032-03-16', 'pending', 'Pakistan')]),
            array_merge($base, ['full_name' => 'Sergey Smirnov', 'first_name' => 'Sergey', 'last_name' => 'Smirnov', 'dob' => '1982-12-19', 'nationality' => 'Russia', 'residency' => 'non_resident', 'member_category' => 'walk_in', 'occupation' => 'Importer', 'source_of_funds' => 'Business income', 'expected_activity' => 'High volume cash purchases of investment gold', 'phone' => '+7 925 881 3402', 'email' => 's.smirnov@example.com',
                'doc' => $doc('passport', '734098812', '2020-10-30', '2030-10-29', 'pending', 'Russia')]),
            array_merge($base, ['full_name' => 'Noor Al Din', 'first_name' => 'Noor', 'last_name' => 'Al Din', 'dob' => '1991-03-15', 'nationality' => 'Syria', 'residency' => 'non_resident', 'member_category' => 'walk_in', 'occupation' => 'Broker — real estate', 'source_of_funds' => 'Commission income', 'expected_activity' => 'Cash-heavy purchases, high volume', 'phone' => '+971 54 661 2087', 'email' => 'noor.aldin@example.com',
                'doc' => $doc('passport', 'N01098234', '2019-01-21', '2025-01-20', 'partial', 'Syria')]),
            array_merge($base, ['full_name' => 'Dmitri Orlov', 'first_name' => 'Dmitri', 'last_name' => 'Orlov', 'dob' => '1985-09-28', 'nationality' => 'Russia', 'residency' => 'resident', 'member_category' => 'regular', 'occupation' => 'Engineer', 'source_of_funds' => 'Salary', 'expected_activity' => 'Occasional card purchases', 'phone' => '+971 52 904 5517', 'email' => 'dmitri.orlov@example.com',
                'doc' => $doc('emirates_id', '784-1985-8821304-1', '2024-08-08', '2028-08-07', 'partial')]),
            array_merge($base, ['full_name' => 'Yusuf Demir', 'first_name' => 'Yusuf', 'last_name' => 'Demir', 'dob' => '1990-04-04', 'nationality' => 'Turkey', 'residency' => 'resident', 'member_category' => 'walk_in', 'occupation' => 'Chef', 'source_of_funds' => 'Salary', 'expected_activity' => 'Occasional gold and platinum purchases', 'phone' => '+971 56 118 7742', 'email' => 'yusuf.demir@example.com',
                'doc' => $doc('passport', 'U20981773', '2023-02-11', '2033-02-10', 'pending', 'Turkey')]),
            array_merge($base, ['full_name' => 'Olga Ivanova', 'first_name' => 'Olga', 'last_name' => 'Ivanova', 'dob' => '1993-06-21', 'nationality' => 'Russia', 'residency' => 'non_resident', 'member_category' => 'regular', 'occupation' => 'Consultant', 'source_of_funds' => 'Professional income', 'expected_activity' => 'Jewellery purchases while travelling', 'phone' => '+7 903 551 7820', 'email' => 'olga.ivanova@example.com',
                'doc' => $doc('passport', '759021384', '2021-07-19', '2031-07-18', 'pending', 'Russia')]),
            array_merge($base, ['full_name' => 'Peter Mwangi', 'first_name' => 'Peter', 'last_name' => 'Mwangi', 'dob' => '1986-02-11', 'nationality' => 'Kenya', 'residency' => 'resident', 'member_category' => 'regular', 'occupation' => 'Logistics manager', 'source_of_funds' => 'Salary', 'expected_activity' => 'Regular savings purchases', 'phone' => '+971 50 389 2214', 'email' => 'peter.mwangi@example.com',
                'doc' => $doc('emirates_id', '784-1986-6187204-2', '2023-11-27', '2027-11-26', 'verified')]),
            array_merge($base, ['full_name' => 'Grace Okafor', 'first_name' => 'Grace', 'last_name' => 'Okafor', 'dob' => '1994-08-08', 'nationality' => 'Nigeria', 'residency' => 'resident', 'member_category' => 'walk_in', 'occupation' => 'Nurse', 'source_of_funds' => 'Salary', 'expected_activity' => 'Occasional jewellery purchases', 'phone' => '+971 58 442 9031', 'email' => 'grace.okafor@example.com',
                'doc' => $doc('passport', 'A11982034', '2022-09-05', '2032-09-04', 'partial', 'Nigeria')]),
        ];
    }

    private function transactions(): array
    {
        $t = fn (string $c, int $d, float $amt, string $m, string $desc, ?float $w = null, string $type = 'buy', ?string $metal = 'gold') => [
            'customer' => $c, 'days_ago' => $d, 'amount' => $amt, 'method' => $m,
            'desc' => $desc, 'weight' => $w, 'type' => $type, 'metal' => $metal,
        ];
        return [
            $t('Salim Al Falasi', 2, 62000, 'cash', '24k gold bar 100g with coins', 145),
            $t('Salim Al Falasi', 20, 12500, 'card', 'Gold coins set', 30),
            $t('Salim Al Falasi', 33, 8400, 'bank_transfer', 'Sale of gold bangle set', 20, 'sell'),
            $t('Imran Sheikh', 6, 19500, 'cash', 'Gold bar purchase', 46),
            $t('Imran Sheikh', 4, 19500, 'cash', 'Gold bar purchase', 46),
            $t('Imran Sheikh', 2, 19500, 'cash', 'Gold bar purchase', 45),
            $t('Khalid Al Amiri', 5, 240000, 'bank_transfer', 'Investment gold bars — corporate order', 560, 'sell'),
            $t('Khalid Al Amiri', 15, 48000, 'bank_transfer', 'Gold bars for corporate gifting', 112),
            $t('Mariam Khalid Al Suwaidi', 1, 15800, 'card', 'Gold necklace set', 37),
            $t('Mariam Khalid Al Suwaidi', 12, 9200, 'cash', 'Gold bracelet', 21),
            $t('Mariam Khalid Al Suwaidi', 28, 6100, 'card', 'Silver jewellery set', 780, 'sell', 'silver'),
            $t('Mariam Khalid Al Suwaidi', 35, 4500, 'cash', 'Gold earrings', 10),
            $t('Priya Nair', 3, 22400, 'card', 'Diamond ring 1.2ct', null, 'buy', 'diamond'),
            $t('Priya Nair', 18, 7300, 'cash', 'Gold chain', 17),
            $t('Mohamed El Sayed', 7, 33900, 'cash', 'Gold coins — savings purchase', 79),
            $t('Mohamed El Sayed', 25, 18200, 'bank_transfer', 'Gold bar 40g', 42),
            $t('Peter Mwangi', 9, 11400, 'card', 'Gold wedding band set', 26),
            $t('Peter Mwangi', 40, 5600, 'bank_transfer', 'Sale of gold chain', 13, 'sell'),
            $t('Rajesh Menon', 8, 27400, 'cash', 'Gold bar and coins', 64),
            $t('Rajesh Menon', 8, 3100, 'cash', 'Gold pendant', 7),
            $t('Bilal Ahmad', 3, 2400, 'card', 'Gold ring', 5),
            $t('Bilal Ahmad', 3, 1800, 'cash', 'Gold studs', 4),
            $t('Bilal Ahmad', 3, 2950, 'card', 'Gold chain', 7),
            $t('Bilal Ahmad', 3, 1500, 'cash', 'Gold pendant', 3),
            $t('Bilal Ahmad', 3, 2100, 'card', 'Gold bracelet', 5),
            $t('Fatima Noor', 4, 13600, 'cash', 'Gold jewellery set', 32),
            $t('Fatima Noor', 21, 4800, 'card', 'Gold ring', 11),
            $t('Yusuf Demir', 6, 16900, 'bank_transfer', 'Platinum band', 15, 'buy', 'platinum'),
            $t('Yusuf Demir', 30, 8900, 'cash', 'Gold chain', 20),
            $t('Noor Al Din', 2, 44700, 'cash', 'Gold bars — cash purchase', 104),
            $t('Sergey Smirnov', 5, 51000, 'cash', 'Investment gold bars', 119),
            $t('Dmitri Orlov', 11, 19800, 'card', 'Gold bar 45g', 46),
            $t('Grace Okafor', 10, 6700, 'cash', 'Gold necklace', 15),
            $t('Sunita Sharma', 14, 3900, 'card', 'Gold earrings', 9),
            $t('Latifa Al Hashemi', 13, 10200, 'card', 'Bridal gold set deposit', 24),
            $t('Olga Ivanova', 16, 12900, 'bank_transfer', 'Sale of gold jewellery', 30, 'sell'),
            $t('Jamal Khaled Muhammad Hussein Al-Taie', 1, 5600, 'cash', 'Gold ring', 13),
            $t('Aneesh Doshi', 19, 28750, 'bank_transfer', 'Investment gold bar', 67),
            $t('Vladimir Petrov', 17, 41500, 'bank_transfer', 'Gold bars purchase', 97),
            $t('Omar Hassan Mahmoud', 20, 9800, 'cash', 'Gold chain purchase', 23),
        ];
    }
}
