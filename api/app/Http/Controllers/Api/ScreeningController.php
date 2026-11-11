<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Screening;
use App\Models\ScreeningProvider;
use App\Models\WatchlistEntry;
use App\Services\AuditLogger;
use App\Services\OpenSanctionsService;
use App\Services\ScreeningService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class ScreeningController extends Controller
{
    private const LIST_MAP = [
        'ofac' => 'OFAC SDN',
        'eu' => 'EU Consolidated',
        'un' => 'UN Security Council',
        'uk' => 'UK Sanctions',
    ];

    public function __construct(
        private ScreeningService $screening,
        private OpenSanctionsService $openSanctions,
    ) {}

    public function providers(Request $request)
    {
        $providers = ScreeningProvider::orderBy('id')->get()->map(fn ($p) => $this->presentProvider($p));
        return ApiResponse::ok(['providers' => $providers]);
    }

    public function updateProvider(Request $request, string $provider)
    {
        if (!in_array($provider, ['opensanctions', 'ofac', 'eu', 'un', 'uk', 'dowjones'], true)) {
            return ApiResponse::error('Unknown provider.', 404);
        }
        $data = $request->validate([
            'is_enabled' => ['sometimes', 'boolean'],
            'mode' => ['sometimes', 'in:realtime,file,loaded'],
            'api_key' => ['nullable', 'string', 'max:255'],
            'threshold' => ['sometimes', 'numeric', 'min:0.5', 'max:0.99'],
            'logic' => ['sometimes', 'string', 'max:20'],
            'sync_schedule' => ['nullable', 'string', 'max:60'],
            'status_text' => ['nullable', 'string', 'max:255'],
        ]);

        $model = ScreeningProvider::where('provider', $provider)->first()
            ?? new ScreeningProvider(['company_id' => $request->user()->company_id, 'provider' => $provider]);

        foreach (['is_enabled', 'mode', 'threshold', 'logic', 'sync_schedule', 'status_text'] as $f) {
            if (array_key_exists($f, $data)) $model->{$f} = $data[$f];
        }
        if (!empty($data['api_key'])) {
            $model->api_key = $data['api_key'];
        }
        $model->save();

        AuditLogger::log('settings.provider_updated', $model->company_id, $request->user()->id, 'screening_provider', $model->id, ['provider' => $provider]);

        return ApiResponse::ok(['provider' => $this->presentProvider($model->fresh())], 'Provider settings saved.');
    }

    public function testConnection(Request $request)
    {
        $provider = ScreeningProvider::where('provider', 'opensanctions')->first();
        if (!$provider) return ApiResponse::error('OpenSanctions provider is not configured.', 404);
        $result = $this->openSanctions->testConnection($provider);
        return ApiResponse::ok($result, $result['message']);
    }

    private function presentProvider(ScreeningProvider $p): array
    {
        $out = [
            'id' => $p->id,
            'provider' => $p->provider,
            'is_enabled' => $p->is_enabled,
            'mode' => $p->mode,
            'threshold' => $p->threshold !== null ? (float) $p->threshold : null,
            'logic' => $p->logic,
            'dataset_size' => $p->dataset_size,
            'sync_schedule' => $p->sync_schedule,
            'last_sync_at' => $p->last_sync_at,
            'status_text' => $p->status_text,
            'has_key' => false,
            'api_key_masked' => null,
            'api_key_stored_at' => null,
        ];
        if ($p->provider === 'opensanctions') {
            $key = $p->api_key;
            $out['has_key'] = !empty($key);
            $out['api_key_masked'] = $key ? '••••'.substr($key, -4) : null;
            $out['api_key_stored_at'] = $key ? $p->updated_at : null;
            if (!$key) {
                $out['status_text'] = $p->status_text ?: 'Local fallback active — add an API key for live OpenSanctions data.';
            }
        }
        if (isset(self::LIST_MAP[$p->provider])) {
            $entries = WatchlistEntry::where('source_list', self::LIST_MAP[$p->provider])->where('is_active', true)->get();
            $names = $entries->sum(fn ($e) => 1 + count($e->aliases ?? []));
            $out['dataset_size'] = $entries->count().' entities · '.number_format($names).' names';
            $out['entities'] = $entries->count();
            $out['names'] = $names;
        }
        if ($p->provider === 'dowjones') {
            $out['status_text'] = 'Requires your own Dow Jones Risk & Compliance subscription.';
        }
        return $out;
    }

    public function test(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'dob' => ['nullable', 'date'],
            'nationality' => ['nullable', 'string', 'max:120'],
        ]);
        $screening = $this->screening->performScreening($request->user()->company, $data, $request->user()->id, [
            'source' => 'manual', 'is_test' => true, 'create_alerts' => false,
        ]);
        return ApiResponse::ok(['screening' => $screening, 'candidates' => $screening->results ?? []]);
    }

    public function nameCheck(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'dob' => ['nullable', 'date'],
            'nationality' => ['nullable', 'string', 'max:120'],
            'save' => ['sometimes', 'boolean'],
            'customer_id' => ['nullable', 'integer'],
        ]);

        $customer = null;
        if (!empty($data['customer_id'])) {
            $customer = Customer::find($data['customer_id']);
            if (!$customer) return ApiResponse::error('Customer not found.', 404);
        }

        $screening = $this->screening->performScreening($request->user()->company, $data, $request->user()->id, [
            'source' => 'name_checker',
            'customer' => $customer,
            'create_alerts' => (bool) $customer,
        ]);

        return ApiResponse::ok(['screening' => $screening, 'candidates' => $screening->results ?? []]);
    }

    public function bulk(Request $request)
    {
        $data = $request->validate(['csv' => ['required', 'string', 'max:200000']]);
        $user = $request->user();
        $company = $user->company;

        $lines = preg_split('/\r\n|\r|\n/', trim($data['csv']));
        $rows = [];
        foreach ($lines as $i => $line) {
            if (trim($line) === '') continue;
            $parts = str_getcsv($line);
            if ($i === 0 && isset($parts[0]) && mb_strtolower(trim($parts[0])) === 'name') continue; // header
            $rows[] = [
                'name' => trim($parts[0] ?? ''),
                'dob' => isset($parts[1]) && trim($parts[1]) !== '' ? trim($parts[1]) : null,
                'nationality' => isset($parts[2]) && trim($parts[2]) !== '' ? trim($parts[2]) : null,
            ];
        }
        $rows = array_values(array_filter($rows, fn ($r) => $r['name'] !== ''));

        $summaries = [];
        $withMatches = 0;
        foreach ($rows as $row) {
            $screening = $this->screening->performScreening($company, $row, $user->id, [
                'source' => 'bulk', 'create_alerts' => false,
            ]);
            if ($screening->candidates_count > 0) $withMatches++;
            $summaries[] = [
                'screening_id' => $screening->id,
                'name' => $row['name'],
                'status' => $screening->status,
                'best_score' => $screening->best_score,
                'candidates_count' => $screening->candidates_count,
                'mode' => $screening->mode,
            ];
        }

        return ApiResponse::ok([
            'rows_processed' => count($rows),
            'with_matches' => $withMatches,
            'screenings' => $summaries,
        ], 'Bulk screening completed.');
    }

    public function index(Request $request)
    {
        $q = Screening::query()->with('customer:id,full_name,customer_no')->latest();
        foreach (['status', 'mode', 'source', 'customer_id'] as $f) {
            if ($v = $request->query($f)) $q->where($f, $v);
        }
        if ($s = $request->query('search')) {
            $q->where('subject_name', 'like', "%{$s}%");
        }
        return ApiResponse::paginated($q->paginate(15));
    }

    public function show(Screening $screening)
    {
        return ApiResponse::ok(['screening' => $screening->load('customer:id,full_name,customer_no', 'alerts')]);
    }
}
