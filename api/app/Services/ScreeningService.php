<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Customer;
use App\Models\Screening;
use App\Models\ScreeningAlert;
use App\Models\ScreeningProvider;
use App\Models\WatchlistEntry;
use Illuminate\Support\Carbon;

class ScreeningService
{
    public const ENGINE_VERSION = 'local-1.0';

    public function __construct(private OpenSanctionsService $openSanctions) {}

    /* ------------------------------------------------------------------ */
    /*  Name normalisation + fuzzy scoring                                 */
    /* ------------------------------------------------------------------ */

    public static function normalise(?string $name): string
    {
        if (!$name) return '';
        $name = mb_strtolower(trim($name));
        // Keep latin + arabic letters, digits and spaces; drop punctuation.
        $name = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $name);
        $name = preg_replace('/\s+/u', ' ', $name);
        return trim($name);
    }

    public static function tokens(string $normalised): array
    {
        return $normalised === '' ? [] : explode(' ', $normalised);
    }

    public static function jaro(string $s1, string $s2): float
    {
        if ($s1 === $s2) return 1.0;
        $a = mb_str_split($s1);
        $b = mb_str_split($s2);
        $len1 = count($a);
        $len2 = count($b);
        if ($len1 === 0 || $len2 === 0) return 0.0;
        $dist = max(0, (int) (max($len1, $len2) / 2) - 1);
        $m1 = array_fill(0, $len1, false);
        $m2 = array_fill(0, $len2, false);
        $matches = 0;
        for ($i = 0; $i < $len1; $i++) {
            $start = max(0, $i - $dist);
            $end = min($i + $dist + 1, $len2);
            for ($j = $start; $j < $end; $j++) {
                if ($m2[$j] || $a[$i] !== $b[$j]) continue;
                $m1[$i] = true; $m2[$j] = true; $matches++;
                break;
            }
        }
        if ($matches === 0) return 0.0;
        $t = 0; $k = 0;
        for ($i = 0; $i < $len1; $i++) {
            if (!$m1[$i]) continue;
            while (!$m2[$k]) $k++;
            if ($a[$i] !== $b[$k]) $t++;
            $k++;
        }
        $t = $t / 2;
        return (($matches / $len1) + ($matches / $len2) + (($matches - $t) / $matches)) / 3;
    }

    public static function jaroWinkler(string $s1, string $s2): float
    {
        $j = self::jaro($s1, $s2);
        $prefix = 0;
        $max = min(4, mb_strlen($s1), mb_strlen($s2));
        for ($i = 0; $i < $max; $i++) {
            if (mb_substr($s1, $i, 1) === mb_substr($s2, $i, 1)) $prefix++;
            else break;
        }
        return $j + ($prefix * 0.1 * (1 - $j));
    }

    private static function soundexSet(array $tokens): array
    {
        $set = [];
        foreach ($tokens as $tok) {
            // Very short tokens (e.g. "al") are phonetically meaningless.
            if (mb_strlen($tok) >= 3 && preg_match('/^[a-z]+$/', $tok)) {
                $sx = soundex($tok);
                if ($sx && $sx !== '0000') $set[] = $sx;
            }
        }
        return $set;
    }

    private static function tokenPairScore(string $a, string $b): float
    {
        if ($a === $b) return 100.0;
        similar_text($a, $b, $p);
        return max($p, self::jaroWinkler($a, $b) * 100);
    }

    /** Length-weighted average of each token's best match in the other name. */
    private static function tokenAverage(array $from, array $to): float
    {
        $sum = 0.0; $weight = 0;
        foreach ($from as $tok) {
            $best = 0.0;
            foreach ($to as $other) {
                $best = max($best, self::tokenPairScore($tok, $other));
            }
            $w = max(1, mb_strlen($tok));
            $sum += $best * $w;
            $weight += $w;
        }
        return $weight ? $sum / $weight : 0.0;
    }

    /**
     * Score a subject against one watchlist name variant.
     * Returns 0-100 before DOB/nationality adjustments.
     *
     * The blend deliberately balances three signals so that a shared common
     * first name alone cannot produce a match: bidirectional token coverage
     * (45%), whole-string similar_text (30%) and Jaro-Winkler (25%). A
     * family-name (last token) mismatch caps the score below threshold.
     */
    private static function nameScore(string $subjectNorm, array $subjectTokens, string $entryNorm, array $entryTokens): float
    {
        if ($subjectNorm === '' || $entryNorm === '') return 0.0;
        if ($subjectNorm === $entryNorm) return 100.0;

        // Same set of tokens, different order (e.g. "Laden Bin Osama") -> exact.
        $sSorted = $subjectTokens; sort($sSorted);
        $eSorted = $entryTokens; sort($eSorted);
        if ($sSorted === $eSorted) return 100.0;

        similar_text($subjectNorm, $entryNorm, $st);
        $jw = self::jaroWinkler($subjectNorm, $entryNorm) * 100;

        $tokenBi = (self::tokenAverage($subjectTokens, $entryTokens) + self::tokenAverage($entryTokens, $subjectTokens)) / 2;

        $base = 0.45 * $tokenBi + 0.30 * $st + 0.25 * $jw;

        // Phonetic boost: shared soundex on any meaningful token pair.
        $sSx = self::soundexSet($subjectTokens);
        $eSx = self::soundexSet($entryTokens);
        if ($sSx && $eSx && array_intersect($sSx, $eSx) && $base >= 45) {
            $base = min(100, $base + 8);
        }

        // Family-name gate: if both names have a last token and they clearly
        // differ, this is a namesake, not a match.
        if (count($subjectTokens) >= 2 && count($entryTokens) >= 2) {
            $lastScore = self::tokenPairScore(end($subjectTokens), end($entryTokens));
            if ($lastScore < 60) {
                $base = min($base, 68);
            }
        }

        return $base;
    }

    /**
     * Score one watchlist entry (name + aliases + arabic name).
     * Returns [score:int, matched_name:string].
     */
    public function scoreEntry(array $subject, WatchlistEntry $entry): array
    {
        $subjectNorm = self::normalise($subject['name'] ?? '');
        $subjectTokens = self::tokens($subjectNorm);

        $variants = array_merge([$entry->full_name], $entry->aliases ?? []);
        $best = 0.0; $bestName = $entry->full_name;
        foreach ($variants as $variant) {
            $norm = self::normalise($variant);
            $score = self::nameScore($subjectNorm, $subjectTokens, $norm, self::tokens($norm));
            if ($score > $best) { $best = $score; $bestName = $variant; }
        }

        // Arabic comparison when either side carries an Arabic name.
        $subjectAr = $subject['name_ar'] ?? null;
        if ($entry->name_ar && ($subjectAr || preg_match('/\p{Arabic}/u', $subject['name'] ?? ''))) {
            $arSubject = self::normalise($subjectAr ?: $subject['name']);
            $arEntry = self::normalise($entry->name_ar);
            similar_text($arSubject, $arEntry, $arScore);
            $arScore = max($arScore, self::jaroWinkler($arSubject, $arEntry) * 100);
            if ($arScore > $best) { $best = $arScore; $bestName = $entry->name_ar; }
        }

        // DOB adjustment.
        $subjectDob = $subject['dob'] ?? null;
        if ($subjectDob && $entry->dob) {
            $entryDob = $entry->dob->format('Y-m-d');
            $subDob = $subjectDob instanceof \DateTimeInterface ? $subjectDob->format('Y-m-d') : (string) $subjectDob;
            $best += ($entryDob === $subDob) ? 5 : -15;
        }

        // Nationality adjustment.
        $subjectNat = isset($subject['nationality']) ? mb_strtolower(trim((string) $subject['nationality'])) : '';
        $entryNat = $entry->nationality ? mb_strtolower(trim($entry->nationality)) : '';
        if ($subjectNat !== '' && $entryNat !== '' && ($subjectNat === $entryNat || str_contains($entryNat, $subjectNat) || str_contains($subjectNat, $entryNat))) {
            $best += 3;
        }

        return [(int) max(0, min(100, round($best))), $bestName];
    }

    /**
     * Run the local engine over all active watchlist entries.
     * Returns candidate arrays >= threshold (0-1 fraction), sorted desc.
     */
    public function screenLocally(array $subject, float $threshold): array
    {
        $min = (int) round($threshold * 100);
        $candidates = [];
        foreach (WatchlistEntry::where('is_active', true)->get() as $entry) {
            [$score, $matchedName] = $this->scoreEntry($subject, $entry);
            if ($score >= $min) {
                $candidates[] = [
                    'watchlist_entry_id' => $entry->id,
                    'entity_id' => $entry->external_id,
                    'name' => $entry->full_name,
                    'matched_name' => $matchedName,
                    'score' => $score,
                    'list_name' => $entry->source_list,
                    'datasets' => [$entry->source_list],
                    'dob' => $entry->dob?->format('Y-m-d'),
                    'nationality' => $entry->nationality,
                    'programmes' => $entry->programmes ?? [],
                    'summary' => $entry->summary,
                    'engine' => 'local',
                ];
            }
        }
        usort($candidates, fn ($a, $b) => $b['score'] <=> $a['score']);
        return $candidates;
    }

    /* ------------------------------------------------------------------ */
    /*  Full screening run (persisted)                                     */
    /* ------------------------------------------------------------------ */

    public function osProvider(Company $company): ?ScreeningProvider
    {
        return ScreeningProvider::withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where('provider', 'opensanctions')
            ->first();
    }

    /**
     * Performs a screening: local engine + OpenSanctions (when enabled & keyed,
     * with graceful fallback). Persists the Screening record and, when a
     * customer is attached, updates the customer and raises alerts.
     *
     * $opts: source, is_test, create_alerts
     */
    public function performScreening(Company $company, array $subject, ?int $performedBy, array $opts = []): Screening
    {
        $source = $opts['source'] ?? 'manual';
        $isTest = (bool) ($opts['is_test'] ?? false);
        $createAlerts = (bool) ($opts['create_alerts'] ?? true);
        $customer = $opts['customer'] ?? null;

        $provider = $this->osProvider($company);
        $threshold = $provider ? (float) $provider->threshold : 0.70;
        if ($threshold <= 0 || $threshold > 1) $threshold = 0.70;

        $started = microtime(true);
        $local = $this->screenLocally($subject, $threshold);

        $engine = 'local';
        $credits = 0;
        $osNote = null;
        $candidates = $local;

        // A key saved per company (Screening Configuration) wins. The
        // deployment-wide .env key (OPENSANCTIONS_API_KEY) is the fallback,
        // so a fresh install screens live without per-company setup. A
        // company with its own key keeps control of its on/off toggle.
        $serverKey = config('services.opensanctions.key');
        $osProvider = $provider;
        if (!$osProvider && $serverKey) {
            $osProvider = new ScreeningProvider([
                'company_id' => $company->id,
                'provider' => 'opensanctions',
                'is_enabled' => true,
                'threshold' => $threshold,
            ]);
        }
        $osReady = $osProvider
            && (!empty($osProvider->api_key) || !empty($serverKey))
            && (!empty($osProvider->api_key) ? $osProvider->is_enabled : true);

        if ($osReady) {
            $os = $this->openSanctions->match($company, $osProvider, $subject, $source === 'bulk' ? 'Bulk screening' : ($isTest ? 'Test screening' : 'Name screening'));
            if ($os['ok']) {
                $engine = 'opensanctions';
                $credits = 1;
                $candidates = $this->mergeCandidates($local, $os['candidates'], $threshold);
            } else {
                $osNote = $os['error'] ?? 'OpenSanctions unavailable — local results used.';
            }
        }

        $duration = (int) round((microtime(true) - $started) * 1000);
        $best = $candidates ? max(array_column($candidates, 'score')) : 0;

        if ($osNote) {
            foreach ($candidates as &$c) { $c['note'] = $osNote; }
            unset($c);
        }

        $screening = Screening::create([
            'company_id' => $company->id,
            'customer_id' => $customer?->id,
            'subject_name' => $subject['name'],
            'subject_dob' => $subject['dob'] ?? null,
            'subject_nationality' => $subject['nationality'] ?? null,
            'mode' => $isTest ? 'test' : $engine,
            'source' => $source,
            'threshold' => $threshold,
            'engine_version' => $engine === 'opensanctions' ? 'opensanctions-api' : self::ENGINE_VERSION,
            'status' => $candidates ? 'potential_match' : 'clear',
            'best_score' => $best,
            'candidates_count' => count($candidates),
            'duration_ms' => $duration,
            'credits_used' => $credits,
            'results' => $candidates,
            'performed_by' => $performedBy,
        ]);

        if ($customer && $createAlerts) {
            $this->applyToCustomer($company, $customer, $screening, $candidates);
        }

        AuditLogger::log('screening.performed', $company->id, $performedBy, 'screening', $screening->id, [
            'subject' => $subject['name'],
            'mode' => $screening->mode,
            'best_score' => $best,
            'candidates' => count($candidates),
            'source' => $source,
        ]);

        return $screening;
    }

    private function mergeCandidates(array $local, array $remote, float $threshold): array
    {
        $min = (int) round($threshold * 100);
        $byName = [];
        foreach ($local as $c) {
            $byName[mb_strtolower($c['name'])] = $c;
        }
        foreach ($remote as $c) {
            if ($c['score'] < $min) continue;
            $key = mb_strtolower($c['name']);
            if (!isset($byName[$key]) || $c['score'] > $byName[$key]['score']) {
                $byName[$key] = $c;
            }
        }
        $all = array_values($byName);
        usort($all, fn ($a, $b) => $b['score'] <=> $a['score']);
        return $all;
    }

    private function applyToCustomer(Company $company, Customer $customer, Screening $screening, array $candidates): void
    {
        if (!$candidates) {
            if ($customer->screening_status !== 'confirmed_match') {
                $customer->screening_status = 'clear';
            }
            $customer->save();
            return;
        }

        if ($customer->screening_status !== 'confirmed_match') {
            $customer->screening_status = 'under_review';
        }
        $customer->save();

        foreach ($candidates as $c) {
            $priority = $c['score'] >= 90 ? 'high' : 'review';
            $exists = ScreeningAlert::withoutGlobalScopes()
                ->where('company_id', $company->id)
                ->where('customer_id', $customer->id)
                ->whereIn('status', ['open', 'under_review'])
                ->where(function ($q) use ($c) {
                    if (!empty($c['watchlist_entry_id'])) {
                        $q->where('watchlist_entry_id', $c['watchlist_entry_id']);
                    } elseif (!empty($c['entity_id'])) {
                        $q->where('external_ref', $c['entity_id']);
                    } else {
                        $q->where('matched_name', $c['matched_name']);
                    }
                })
                ->exists();
            if ($exists) continue;

            ScreeningAlert::create([
                'company_id' => $company->id,
                'customer_id' => $customer->id,
                'screening_id' => $screening->id,
                'watchlist_entry_id' => $c['watchlist_entry_id'] ?? null,
                'external_ref' => $c['entity_id'] ?? null,
                'matched_name' => $c['matched_name'] ?? $c['name'],
                'match_score' => $c['score'],
                'list_name' => $c['list_name'] ?? 'OpenSanctions',
                'priority' => $priority,
                'status' => 'open',
                'due_at' => $priority === 'high' ? Carbon::now()->addDay() : Carbon::now()->addDays(3),
            ]);
        }
    }
}
