<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerDocument;
use App\Services\AuditLogger;
use App\Services\RiskService;
use App\Services\ScreeningService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function __construct(
        private ScreeningService $screening,
        private RiskService $risk,
    ) {}

    public function index(Request $request)
    {
        $q = Customer::query()->latest();
        if ($s = $request->query('search')) {
            $q->where(function ($w) use ($s) {
                $w->where('full_name', 'like', "%{$s}%")
                    ->orWhere('customer_no', 'like', "%{$s}%")
                    ->orWhere('phone', 'like', "%{$s}%")
                    ->orWhere('email', 'like', "%{$s}%");
            });
        }
        foreach (['status', 'risk_level', 'screening_status', 'kyc_status', 'type'] as $f) {
            if ($v = $request->query($f)) $q->where($f, $v);
        }
        return ApiResponse::paginated($q->paginate(15));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'type' => ['sometimes', 'in:individual,corporate'],
            'member_category' => ['sometimes', 'in:walk_in,regular,vip,corporate'],
            'residency' => ['sometimes', 'in:resident,non_resident,gcc'],
            'full_name' => ['required', 'string', 'max:255'],
            'first_name' => ['nullable', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'name_ar' => ['nullable', 'string', 'max:255'],
            'dob' => ['nullable', 'date'],
            'gender' => ['nullable', 'string', 'max:20'],
            'nationality' => ['nullable', 'string', 'max:120'],
            'occupation' => ['nullable', 'string', 'max:255'],
            'employer' => ['nullable', 'string', 'max:255'],
            'source_of_funds' => ['nullable', 'string', 'max:255'],
            'expected_activity' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'whatsapp' => ['nullable', 'string', 'max:40'],
            'address_line' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:120'],
            'country' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string'],
            'documents' => ['sometimes', 'array'],
            'documents.*.doc_type' => ['required_with:documents', 'in:emirates_id,gcc_id,passport,labor_card,driving_license,trade_license,visa'],
            'documents.*.doc_number' => ['required_with:documents', 'string', 'max:120'],
            'documents.*.issuing_country' => ['nullable', 'string', 'max:120'],
            'documents.*.issue_date' => ['nullable', 'date'],
            'documents.*.expiry_date' => ['nullable', 'date'],
            'documents.*.file_name' => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();
        $company = $user->company;

        $customerData = collect($data)->except('documents')->all();
        $customerData['company_id'] = $company->id;
        $customerData['customer_no'] = Customer::nextNumber($company->id);
        $customerData['created_by'] = $user->id;
        if (empty($customerData['full_name']) && !empty($customerData['first_name'])) {
            $customerData['full_name'] = trim(collect([$customerData['first_name'] ?? null, $customerData['middle_name'] ?? null, $customerData['last_name'] ?? null])->filter()->implode(' '));
        }

        $customer = Customer::create($customerData);

        foreach (($data['documents'] ?? []) as $doc) {
            $customer->documents()->create(array_merge($doc, [
                'company_id' => $company->id,
                'verification' => $this->emptyChecklist(),
            ]));
        }

        AuditLogger::log('customer.created', $company->id, $user->id, 'customer', $customer->id, ['name' => $customer->full_name]);

        // Automatic name screening on save, then risk scoring.
        $screening = $this->screening->performScreening($company, [
            'name' => $customer->full_name,
            'name_ar' => $customer->name_ar,
            'dob' => $customer->dob?->format('Y-m-d'),
            'nationality' => $customer->nationality,
        ], $user->id, ['source' => 'auto', 'customer' => $customer]);

        $customer = $this->risk->recompute($customer->fresh());

        return ApiResponse::ok([
            'customer' => $customer->load('documents'),
            'screening' => $screening,
        ], 'Customer created and screened.', 201);
    }

    public function show(Request $request, Customer $customer)
    {
        $customer->load([
            'documents',
            'screenings' => fn ($q) => $q->latest()->limit(20),
            'alerts' => fn ($q) => $q->latest(),
            'transactions' => fn ($q) => $q->latest('txn_date')->limit(30),
            'cases' => fn ($q) => $q->latest(),
        ]);

        return ApiResponse::ok([
            'customer' => $customer,
            'journey' => $this->journey($customer),
            'attention' => $this->attention($customer),
        ]);
    }

    public function update(Request $request, Customer $customer)
    {
        $data = $request->validate([
            'type' => ['sometimes', 'in:individual,corporate'],
            'member_category' => ['sometimes', 'in:walk_in,regular,vip,corporate'],
            'residency' => ['sometimes', 'in:resident,non_resident,gcc'],
            'full_name' => ['sometimes', 'string', 'max:255'],
            'first_name' => ['nullable', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'name_ar' => ['nullable', 'string', 'max:255'],
            'dob' => ['nullable', 'date'],
            'gender' => ['nullable', 'string', 'max:20'],
            'nationality' => ['nullable', 'string', 'max:120'],
            'occupation' => ['nullable', 'string', 'max:255'],
            'employer' => ['nullable', 'string', 'max:255'],
            'source_of_funds' => ['nullable', 'string', 'max:255'],
            'expected_activity' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'whatsapp' => ['nullable', 'string', 'max:40'],
            'address_line' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:120'],
            'country' => ['nullable', 'string', 'max:120'],
            'status' => ['sometimes', 'in:pending_kyc,active,restricted,rejected,archived'],
            'edd_status' => ['sometimes', 'in:not_required,pending,completed'],
            'next_review_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $customer->update($data);
        $customer = $this->risk->recompute($customer->fresh());

        return ApiResponse::ok(['customer' => $customer], 'Customer updated.');
    }

    public function destroy(Customer $customer)
    {
        $customer->delete();
        return ApiResponse::ok(null, 'Customer archived (soft deleted).');
    }

    public function screen(Request $request, Customer $customer)
    {
        $user = $request->user();
        $screening = $this->screening->performScreening($user->company, [
            'name' => $customer->full_name,
            'name_ar' => $customer->name_ar,
            'dob' => $customer->dob?->format('Y-m-d'),
            'nationality' => $customer->nationality,
        ], $user->id, ['source' => 'manual', 'customer' => $customer]);

        $customer = $this->risk->recompute($customer->fresh());

        return ApiResponse::ok([
            'screening' => $screening,
            'customer' => $customer,
        ], 'Screening completed.');
    }

    public function kyc(Request $request, Customer $customer)
    {
        if (!$request->user()->hasRole(['owner', 'mlro'])) {
            return ApiResponse::error('Only the owner or MLRO can approve or reject KYC.', 403);
        }
        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'notes' => ['nullable', 'string'],
        ]);

        if ($data['decision'] === 'approve') {
            $customer->kyc_status = 'approved';
            if ($customer->screening_status !== 'confirmed_match' && $customer->status !== 'restricted') {
                $customer->status = 'active';
            }
            if (!$customer->next_review_date) {
                $customer->next_review_date = now()->addYear();
            }
            $action = 'customer.kyc_approved';
        } else {
            $customer->kyc_status = 'rejected';
            $customer->status = 'rejected';
            $action = 'customer.kyc_rejected';
        }
        if (!empty($data['notes'])) {
            $customer->notes = trim(($customer->notes ? $customer->notes."\n" : '').$data['notes']);
        }
        $customer->save();

        AuditLogger::log($action, $customer->company_id, $request->user()->id, 'customer', $customer->id, ['decision' => $data['decision']]);

        return ApiResponse::ok(['customer' => $customer->fresh()], 'KYC '.$data['decision'].'d.');
    }

    public function storeDocument(Request $request, Customer $customer)
    {
        $data = $request->validate([
            'doc_type' => ['required', 'in:emirates_id,gcc_id,passport,labor_card,driving_license,trade_license,visa'],
            'doc_number' => ['required', 'string', 'max:120'],
            'issuing_country' => ['nullable', 'string', 'max:120'],
            'issue_date' => ['nullable', 'date'],
            'expiry_date' => ['nullable', 'date'],
            'file_name' => ['nullable', 'string', 'max:255'],
        ]);

        $doc = $customer->documents()->create(array_merge($data, [
            'company_id' => $customer->company_id,
            'verification' => $this->emptyChecklist(),
        ]));

        return ApiResponse::ok(['document' => $doc], 'Document added.', 201);
    }

    /* ---------------------------------------------------------------- */

    private function emptyChecklist(): array
    {
        return [
            'clarity' => 'pending', 'all_sides' => 'pending', 'number_matches' => 'pending',
            'dates_valid' => 'pending', 'details_match' => 'pending', 'authenticity' => 'pending',
        ];
    }

    private function journey(Customer $customer): array
    {
        $docsTotal = $customer->documents->count();
        $docsVerified = $customer->documents->where('verified', true)->count();
        $openAlerts = $customer->alerts->whereIn('status', ['open', 'under_review', 'escalated'])->count();
        $hasScreening = $customer->screenings->count() > 0;
        $confirmed = $customer->screening_status === 'confirmed_match';

        return [
            ['key' => 'registration', 'label' => 'Registration', 'status' => 'done'],
            ['key' => 'document_verification', 'label' => 'Document verification',
                'status' => $docsVerified > 0 ? 'done' : ($docsTotal > 0 ? 'blocked' : 'pending')],
            ['key' => 'related_parties', 'label' => 'Related parties',
                'status' => $customer->type === 'corporate' ? 'pending' : 'not_required'],
            ['key' => 'name_screening', 'label' => 'Name screening',
                'status' => $hasScreening ? 'done' : 'pending'],
            ['key' => 'alert_clearance', 'label' => 'Alert clearance',
                'status' => $openAlerts > 0 ? 'blocked' : ($hasScreening ? 'done' : 'not_started')],
            ['key' => 'risk_assessment', 'label' => 'Risk assessment',
                'status' => $customer->risk_score !== null ? 'done' : 'pending'],
            ['key' => 'edd', 'label' => 'EDD',
                'status' => !$customer->edd_required ? 'not_required' : ($customer->edd_status === 'completed' ? 'done' : 'blocked')],
            ['key' => 'kyc_approval', 'label' => 'KYC approval',
                'status' => $customer->kyc_status === 'approved' ? 'done' : (($openAlerts > 0 || $confirmed) ? 'blocked' : 'pending')],
            ['key' => 'activation', 'label' => 'Activation',
                'status' => $customer->status === 'active' ? 'done' : 'not_started'],
            ['key' => 'ongoing_monitoring', 'label' => 'Ongoing monitoring',
                'status' => $customer->status === 'active' ? 'in_progress' : 'not_started'],
        ];
    }

    private function attention(Customer $customer): array
    {
        $items = [];
        $openAlerts = $customer->alerts->whereIn('status', ['open', 'under_review', 'escalated']);
        foreach ($openAlerts as $alert) {
            $items[] = [
                'type' => 'alert',
                'severity' => $alert->priority === 'high' ? 'high' : 'medium',
                'text' => "Screening alert #{$alert->id} is open — {$alert->match_score}% match to {$alert->matched_name} on {$alert->list_name}. KYC cannot be approved until the alert is closed and screening is cleared.",
            ];
        }
        $unverified = $customer->documents->where('verified', false);
        foreach ($unverified as $doc) {
            $items[] = [
                'type' => 'document',
                'severity' => 'medium',
                'text' => ucfirst(str_replace('_', ' ', $doc->doc_type))." {$doc->doc_number} has not been verified yet.",
            ];
        }
        if ($customer->documents->count() === 0) {
            $items[] = ['type' => 'document', 'severity' => 'high', 'text' => 'No identity document on file. At least one verified document is required before the customer can be activated.'];
        }
        if ($customer->edd_required && $customer->edd_status !== 'completed') {
            $items[] = ['type' => 'edd', 'severity' => 'high', 'text' => "Enhanced due diligence is required (risk score {$customer->risk_score}) and has not been completed."];
        }
        if ($customer->screening_status === 'confirmed_match') {
            $items[] = ['type' => 'screening', 'severity' => 'high', 'text' => 'Confirmed sanctions/watchlist match. This customer is restricted — do not transact.'];
        }
        return $items;
    }
}
