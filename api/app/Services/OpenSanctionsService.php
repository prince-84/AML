<?php

namespace App\Services;

use App\Models\ApiUsage;
use App\Models\Company;
use App\Models\ScreeningProvider;
use Illuminate\Support\Facades\Http;

class OpenSanctionsService
{
    private const ENDPOINT = 'https://api.opensanctions.org/match/default';

    private const COUNTRY_CODES = [
        'united arab emirates' => 'ae', 'uae' => 'ae', 'saudi arabia' => 'sa', 'india' => 'in',
        'pakistan' => 'pk', 'russia' => 'ru', 'russian federation' => 'ru', 'egypt' => 'eg',
        'iraq' => 'iq', 'syria' => 'sy', 'syrian arab republic' => 'sy', 'yemen' => 'ye',
        'iran' => 'ir', 'afghanistan' => 'af', 'north korea' => 'kp', 'china' => 'cn',
        'united states' => 'us', 'usa' => 'us', 'united kingdom' => 'gb', 'uk' => 'gb',
        'lebanon' => 'lb', 'jordan' => 'jo', 'kuwait' => 'kw', 'qatar' => 'qa', 'oman' => 'om',
        'bahrain' => 'bh', 'turkey' => 'tr', 'kenya' => 'ke', 'nigeria' => 'ng', 'sudan' => 'sd',
        'myanmar' => 'mm', 'belarus' => 'by', 'venezuela' => 've', 'ukraine' => 'ua',
        'palestine' => 'ps', 'israel' => 'il', 'philippines' => 'ph', 'bangladesh' => 'bd',
        'sri lanka' => 'lk', 'nepal' => 'np', 'ethiopia' => 'et', 'south korea' => 'kr',
    ];

    public static function countryCode(?string $nationality): ?string
    {
        if (!$nationality) return null;
        $n = mb_strtolower(trim($nationality));
        if (isset(self::COUNTRY_CODES[$n])) return self::COUNTRY_CODES[$n];
        if (preg_match('/^[a-z]{2}$/', $n)) return $n;
        foreach (self::COUNTRY_CODES as $name => $code) {
            if (str_contains($n, $name) || str_contains($name, $n)) return $code;
        }
        return null;
    }

    /**
     * Live match against OpenSanctions. Returns
     * ['ok' => bool, 'candidates' => array, 'error' => ?string].
     * On success, counts one credit into api_usage + the company counter.
     */
    public function match(Company $company, ScreeningProvider $provider, array $subject, string $usageSource = 'Name screening'): array
    {
        $key = $provider->api_key ?: config('services.opensanctions.key');
        if (!$key) {
            return ['ok' => false, 'candidates' => [], 'error' => 'No OpenSanctions API key configured.'];
        }

        $properties = ['name' => [$subject['name']]];
        if (!empty($subject['dob'])) {
            $dob = $subject['dob'] instanceof \DateTimeInterface ? $subject['dob']->format('Y-m-d') : (string) $subject['dob'];
            $properties['birthDate'] = [$dob];
        }
        $cc = self::countryCode($subject['nationality'] ?? null);
        if ($cc) $properties['nationality'] = [$cc];

        try {
            $response = Http::withHeaders([
                'Authorization' => 'ApiKey '.$key,
                'Content-Type' => 'application/json',
            ])->timeout(12)->post(self::ENDPOINT, [
                'queries' => [
                    'q1' => ['schema' => 'Person', 'properties' => $properties],
                ],
            ]);

            if (!$response->successful()) {
                return ['ok' => false, 'candidates' => [], 'error' => 'OpenSanctions returned HTTP '.$response->status().'.'];
            }

            $results = $response->json('responses.q1.results') ?? $response->json('results.q1.results') ?? [];
            $candidates = [];
            foreach ($results as $r) {
                $props = $r['properties'] ?? [];
                $candidates[] = [
                    'watchlist_entry_id' => null,
                    'entity_id' => $r['id'] ?? null,
                    'name' => $r['caption'] ?? ($props['name'][0] ?? 'Unknown'),
                    'matched_name' => $r['caption'] ?? ($props['name'][0] ?? 'Unknown'),
                    'score' => (int) round(((float) ($r['score'] ?? 0)) * 100),
                    'list_name' => 'OpenSanctions',
                    'datasets' => $r['datasets'] ?? [],
                    'topics' => $props['topics'] ?? [],
                    'dob' => $props['birthDate'][0] ?? null,
                    'nationality' => $props['nationality'][0] ?? null,
                    'programmes' => $props['topics'] ?? [],
                    'summary' => isset($props['notes']) ? implode(' ', (array) $props['notes']) : null,
                    'engine' => 'opensanctions',
                ];
            }

            $this->recordCredit($company, $usageSource);

            return ['ok' => true, 'candidates' => $candidates, 'error' => null];
        } catch (\Throwable $e) {
            return ['ok' => false, 'candidates' => [], 'error' => 'OpenSanctions request failed: '.$e->getMessage()];
        }
    }

    private function recordCredit(Company $company, string $source): void
    {
        $month = now()->format('Y-m');
        $usage = ApiUsage::withoutGlobalScopes()->firstOrNew([
            'company_id' => $company->id,
            'provider' => 'opensanctions',
            'month' => $month,
            'source' => $source,
        ]);
        $usage->calls = ($usage->calls ?? 0) + 1;
        $usage->credits = ($usage->credits ?? 0) + 1;
        $usage->save();

        $company->increment('screening_credits_used');
    }

    /**
     * Lightweight connectivity check used by the test-connection action:
     * hits the API root; a 200/401/403 all prove reachability config-wise,
     * but only 200 confirms the key.
     */
    public function testConnection(ScreeningProvider $provider): array
    {
        $key = $provider->api_key ?: config('services.opensanctions.key');
        if (empty($key)) {
            return ['ok' => false, 'message' => 'No API key stored yet. Add a key to enable live OpenSanctions data.'];
        }
        try {
            $response = Http::withHeaders(['Authorization' => 'ApiKey '.$key])
                ->timeout(10)
                ->get('https://api.opensanctions.org/');
            if ($response->successful()) {
                return ['ok' => true, 'message' => 'Connection successful — API key accepted.'];
            }
            return ['ok' => false, 'message' => 'OpenSanctions responded with HTTP '.$response->status().' — check the API key.'];
        } catch (\Throwable $e) {
            return ['ok' => false, 'message' => 'Could not reach OpenSanctions: '.$e->getMessage()];
        }
    }
}
