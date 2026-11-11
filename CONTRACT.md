# ComplyShield — Build Contract (single source of truth for backend + frontend)

An AML/CFT compliance SaaS for DNFBP businesses (jewellery & precious metals first; also real estate, insurance, audit firms), modelled on the Scantero360 product analysed 6 Nov 2026. Cloud multi-tenant SaaS. Light theme only. Must NOT look AI-generated: real product name, consistent design system, human copy, no lorem ipsum, no purple gradients, no generic AI look.

- Product name: **ComplyShield**. Tagline: "Compliance that never sleeps."
- Frontend: Next.js (App Router, TypeScript, Tailwind) in `web/`. API: Laravel in `api/`, MySQL DB `complyshield`.
- API base (dev): backend http://localhost:8000/api , frontend http://localhost:3000 . CORS open for localhost:3000.
- Frontend calls API via `NEXT_PUBLIC_API_URL` (default http://localhost:8000/api).

## Design system (frontend)
- Light theme only: page bg #F7F8FA, cards white, borders #E5E9F0, text slate-900/slate-500.
- Primary: deep teal `#0E7569` (hover #0B5F55); navy ink #0F2A43 for headings/sidebar accents. Accent amber #D97706 for warnings, red #DC2626 for high risk, green #15803D for clear/low.
- Fonts: **Plus Jakarta Sans** (display/headings) + **Inter** (body/UI) via Google Fonts in layout. Numbers tabular.
- Layout: white left sidebar (logo mark = shield in teal rounded square + "ComplyShield"), top bar with company switcher chip, search, screening status pill, user avatar menu. Rounded-xl cards, soft shadows, 13–14px UI text. Sidebar sections exactly as below.
- Status pills & risk chips with dot + label. Toasts for actions. Loading skeletons simple.
- Fully responsive: sidebar collapses to drawer under lg; tables scroll-x; forms stack.

## Tenancy & auth
- `companies` = tenants (subscriber businesses). Every business record belongs to a company. API scoping: all queries filtered by the authenticated user's company_id automatically (global scope or middleware). One seeded platform owner not needed in UI.
- Auth: Laravel Sanctum personal access tokens. POST /auth/login {email,password} -> {token, user, company}. POST /auth/logout. GET /auth/me.
- Roles per user: `owner`, `mlro` (compliance manager), `officer`, `viewer`. Role gates: only mlro/owner can close alerts as true match, approve KYC, file STR. Keep simple: store role, frontend hides buttons, backend checks on those endpoints.
- Subscription: companies.plan (starter/growth/enterprise), plan_expires_at, screening_credits_used (month counter) shown in Settings.

## Database schema (Laravel migrations, MySQL)
- companies: id, name, trade_license_no, sector enum(jewellery, real_estate, insurance, audit, exchange, other), country default 'UAE', city, phone, email, plan, plan_expires_at, screening_credits_used, status, timestamps.
- users: id, company_id FK, name, email unique, password, role enum, phone, last_login_at, timestamps.
- customers: id, company_id, customer_no (e.g. CUS-000001 per company sequence), type enum(individual, corporate), member_category (walk_in, regular, vip, corporate), residency (resident, non_resident, gcc), full_name, first_name, middle_name, last_name, name_ar (nullable), dob (date, nullable), gender, nationality, occupation, employer, source_of_funds, expected_activity, email, phone, whatsapp, address_line, city, country, status enum(pending_kyc, active, restricted, rejected, archived), kyc_status enum(pending, approved, rejected), screening_status enum(not_screened, clear, potential_match, under_review, confirmed_match), risk_level enum(low, medium, high, severe) nullable, risk_score int nullable, edd_required bool, edd_status enum(not_required, pending, completed), next_review_date, notes, created_by, timestamps, soft deletes.
- customer_documents: id, company_id, customer_id, doc_type enum(emirates_id, gcc_id, passport, labor_card, driving_license, trade_license, visa), doc_number, issuing_country, issue_date, expiry_date, file_name (text only, no upload storage required — store placeholder name), verified bool, verification json checklist {clarity, all_sides, number_matches, dates_valid, details_match, authenticity} each pending/verified/failed, verified_by, verified_at, timestamps.
- watchlist_entries (LOCAL screening list, seeded): id, source_list (e.g. 'OFAC SDN', 'EU Consolidated', 'UN Security Council', 'UK Sanctions', 'UAE Terrorist List', 'PEP Database', 'Interpol Red Notices'), external_id nullable, full_name, name_ar nullable, aliases json, dob nullable, nationality nullable, entity_type (person/company), programmes json, summary text, is_active. Global (company_id null).
- screenings: id, company_id, customer_id nullable, subject_name, subject_dob nullable, subject_nationality nullable, mode enum(local, opensanctions, test), source (auto/manual/name_checker/bulk), threshold decimal, engine_version, status enum(clear, potential_match, confirmed), best_score int, candidates_count, duration_ms, credits_used int, results json (array of candidates), performed_by, timestamps.
- screening_alerts: id, company_id, customer_id, screening_id, watchlist_entry_id nullable, external_ref (opensanctions entity id) nullable, matched_name, match_score, list_name, priority enum(low, review, high), status enum(open, under_review, cleared_false_positive, confirmed_match, escalated), decision_notes, decided_by, decided_at, due_at, timestamps.
- transactions: id, company_id, customer_id, txn_no, txn_date, type enum(buy, sell, remittance, policy, service), item_description, metal_type nullable (gold, silver, diamond, platinum), weight_grams nullable, amount decimal, currency default 'AED', payment_method enum(cash, card, bank_transfer, cheque), channel enum(counter, online, phone), status, flagged bool, created_by, timestamps.
- tm_alerts: id, company_id, transaction_id nullable, customer_id, rule_code, title, description, severity enum(low, medium, high), status enum(open, under_review, closed_benign, escalated_to_case), decided_by, decided_at, notes, timestamps.
- cases: id, company_id, case_no, customer_id, source enum(screening, transaction, manual), title, description, status enum(open, investigating, pending_mlro, closed_no_action, str_filed, customer_exited), priority, assigned_to, opened_by, due_at, closed_at, resolution, timestamps.
- str_reports: id, company_id, case_id, customer_id, report_no, report_type enum(STR, SAR), status enum(draft, under_review, filed), reason text, narrative text, amount_involved decimal, goaml_xml text nullable, filed_at, filed_by, timestamps.
- tm_rules (per company, seeded defaults): id, company_id, code, name, description, params json, is_enabled, severity.
- risk_assessments (EWRA): id, company_id, title, period, status enum(draft, in_review, approved), inherent/customer/products/channels/geography/counterparty scores + residual computed, methodology_note, created_by, approved_by, timestamps.
- screening_providers (per company): id, company_id, provider enum(opensanctions, ofac, eu, un, uk, dowjones), is_enabled, mode enum(realtime, file, loaded), api_key (encrypted cast), dataset_size text nullable, sync_schedule, last_sync_at, status_text.
- api_usage: id, company_id, provider, calls, credits, month (Y-m), source.
- audit_logs: id, company_id, user_id, action, subject_type, subject_id, meta json, ip, timestamps. (Log key actions: customer.created, customer.kyc_approved, screening.performed, alert.decided, case.created, str.filed, settings.provider_updated.)
- form_fields (Customer Form Builder): id, company_id, field_key, label, section, is_mandatory, is_enabled, sort.

## Business logic (backend services)
1. **Local screening engine** (ScreeningService): normalises names (lowercase, strip punctuation, collapse spaces; handle Arabic names by also comparing name_ar), scores each watchlist entry: exact=100; token-set similarity via similar_text + Jaro-Winkler-like bonus; phonetic soundex equality boost; DOB match +5, nationality match +3, conflicting DOB -15. Threshold from provider settings (default 70). Returns candidates >= threshold sorted desc. PHP: implement jaro/jaro-winkler manually (short functions) — no external packages.
2. **OpenSanctions driver**: POST https://api.opensanctions.org/match/default, header `Authorization: ApiKey <key>`, body {"queries":{"q1":{"schema":"Person","properties":{"name":[name],"birthDate":[dob],"nationality":[cc]}}}}. Map response results to candidates {name, score*100, datasets, caption/topics, dob, nationality, entity_id}. If no key configured OR API fails -> fall back to local engine and mark mode 'local' with a note. Credits: each live call increments api_usage + companies.screening_credits_used. Test-connection endpoint pings GET https://api.opensanctions.org/entities/... use match with name 'test' minimal — better: GET https://api.opensanctions.org/ (health) or a match call on demand only in test-screening endpoint.
3. **On customer create**: auto-run screening (local + OS if enabled & key) using full name; set customer.screening_status; best candidate >= 90 -> create HIGH screening_alert, status under_review; 70-89 -> 'review' priority alert. Screening record stored with results json.
4. **Risk scoring** (RiskService): points: nationality high-risk country list (AF, IR, KP, SY, YE, RU, MM, SD...) +35; PEP relation or sanctions partial match +40; cash-heavy expected activity +10; non-resident +10; occupation dealer/broker +5; high expected volume +10; adverse flags... clamp 0-100; level: <30 low, 30-59 medium, 60-79 high, >=80 severe. EDD required if score >= 60. Recompute on customer update + nightly not needed.
5. **TM rules engine** (TransactionMonitor) runs on transaction create (and a "Run monitor" button re-scans all): 
   - CASH_THRESHOLD: single cash txn >= AED 55,000 (UAE jewellery cash reporting threshold style) -> alert high.
   - STRUCTURING: >=3 cash txns by same customer within 7 days, each < 55,000, sum >= 55,000 -> high.
   - HIGH_VALUE: amount >= 200,000 any method -> medium.
   - RAPID_SUCCESSION: >=5 txns in 24h same customer -> medium.
   - HIGH_RISK_CUSTOMER: txn by customer with risk high/severe -> medium.
   - DORMANT_SPIKE: first txn in 90 days >= 100,000 -> low. (Seed data may not trigger; fine.)
   Each firing creates tm_alert (dedupe: same rule+customer+open exists -> skip).
6. **Case flow**: alerts (screening or TM) can escalate -> creates case. Case -> create STR draft (prefilled narrative from customer + alerts data). STR "Mark filed" sets status filed + filed_at (mlro only). goAML XML: generate simple XML string with report/subject/activity nodes on STR create, stored, viewable/downloadable.
7. **Dashboard aggregates**: counts (customers total, new today, kyc pending, open screening alerts, overdue alerts (due_at < now & open), open tm alerts, open cases, edd due, high-risk customers, screenings today, total screenings, potential match %), screening status breakdown, alerts by priority, recent activity (audit logs), pipeline status (engine ready, worker online, lists loaded count from watchlist_entries).
8. **Bulk screening**: POST accepts CSV text (name,dob,nationality rows) -> screen each locally (OS if key and rows <= 25) -> return summary + create screening records (source=bulk). Frontend has textarea/file upload.
9. **Providers config**: GET/PUT per company; opensanctions card: enable toggle, mode realtime/file, api_key (write-only, stored encrypted; GET returns has_key + masked last4 + stored_at), threshold, logic. OFAC/EU/UN/UK cards: loaded lists with counts from watchlist_entries where source_list matches; dowjones card: disabled state "Requires your own subscription".

## API endpoints (all /api, auth:sanctum except login; envelope {success, data, message?})
- POST /auth/login, POST /auth/logout, GET /auth/me
- GET /dashboard
- GET /customers (search, filters: status, risk_level, screening_status, kyc_status; paginate 15), POST /customers, GET /customers/{id} (with documents, screenings, alerts, transactions, cases, journey computed), PUT /customers/{id}, DELETE /customers/{id} (soft), POST /customers/{id}/screen (re-run), POST /customers/{id}/kyc {decision: approve|reject, notes}, POST /customers/{id}/documents (store), PUT /documents/{id}/verify {checklist, verified}
- GET /screening/providers, PUT /screening/providers/{provider}, POST /screening/test {name, dob?, nationality?} (test screening like demo: uses OS if key else local; not saved as customer), POST /screening/name-check {name, dob?, nationality?, save:true} (creates screening record; if customer_id given attaches), GET /screenings (list w/ filters), GET /screenings/{id}
- POST /screening/bulk {csv: string}
- GET /alerts (screening alerts; filters status, priority), GET /alerts/{id}, PUT /alerts/{id}/decision {decision: clear_false_positive|confirm_match|escalate, notes} — confirm_match sets customer restricted + screening_status confirmed_match; escalate creates a case.
- GET /transactions, POST /transactions, GET /transactions/{id}, POST /transactions/run-monitor
- GET /tm-alerts, PUT /tm-alerts/{id}/decision {decision: close_benign|escalate, notes} (escalate -> case)
- GET /tm-rules, PUT /tm-rules/{id} {is_enabled, params}
- GET /cases, POST /cases, GET /cases/{id}, PUT /cases/{id} {status, assigned_to, resolution...}
- POST /cases/{id}/str (create STR draft), GET /str-reports, GET /str-reports/{id} (with goaml_xml), PUT /str-reports/{id} {status: filed...}, GET /str-reports/{id}/goaml (download xml)
- GET /risk/ewra, POST /risk/ewra, PUT /risk/ewra/{id}
- GET /settings/company, PUT /settings/company, GET /settings/users, POST /settings/users, PUT /settings/users/{id}, GET /settings/form-fields, PUT /settings/form-fields (bulk update), GET /settings/usage (api_usage by month)
- GET /audit-logs

## Frontend pages (App Router, all wired to API, no dead buttons)
- /login — split screen: left brand panel (teal, product pitch, stats), right form. Demo credentials box shown.
- /(app) layout with sidebar: OVERVIEW: Dashboard (/dashboard), Reports (/reports); CUSTOMER MANAGEMENT: Customers (/customers), Customer Form Builder (/settings/form-builder), Identity Monitoring (/identity-monitoring = customers with expiring/expired docs + pending verify); TRANSACTION MANAGEMENT: Transactions (/transactions), Validation Exceptions -> skip (fold into transactions tab?) — include as /transactions?tab=exceptions simple list of flagged txns. TRANSACTION MONITORING: Monitor (/monitoring), Alerts (/monitoring/alerts), Rules (/monitoring/rules); AML SCREENING: Name Checker (/screening/name-checker), Bulk Screening (/screening/bulk), Screening Configuration (/screening/configuration), Screening Alerts (/screening/alerts), Adverse Media (/screening/adverse-media = screenings with media-ish datasets + alerts list filtered), Investigation Cases (/cases), Screening Monitor (/screening/monitor = recent screenings + engine stats); RISK MANAGEMENT: Enterprise Risk Assessment (/risk/ewra), Risk Register (/risk/register = high/severe customers list); SETTINGS: Company (/settings/company), Users & Roles (/settings/users), Subscription & Usage (/settings/usage).
- /customers/new (wizard 3 steps: Details -> Documents -> Review, with "Scan with phone" QR-style modal — QR generated from a random one-time code using a simple QR of text via `qrcode` npm package or an SVG placeholder pattern; implement qrcode package), /customers/[id] profile with tabs (Overview w/ compliance journey stepper, Profile, Documents, Name Screening, Alerts, Transactions, Risk, Cases) and "what needs attention" panel.
- Dashboard: KPI cards row, screening volume mini bar chart (CSS bars from real data by day), KYC donut (CSS conic), screening status, alerts by priority, recent activity feed, pipeline status.
- Reports page: STR/SAR list + counts + generate from case.
- Every list: search + filters + pagination. Every action shows toast and refreshes. Empty states with real copy.

## Seed data (DemoSeeder) — believable, UAE jewellery context
- Company: "Al Noor Gold & Jewellery LLC", Dubai, sector jewellery, license "DED-1188342", plan growth.
- Users: owner@alnoor.example / password (name: Ahmed Al Mansoori, owner), mlro@alnoor.example / password (Sara Iqbal, MLRO), officer@alnoor.example / password (Omar Farouk, officer). (Frontend demo box uses owner.)
- Second tenant (for tenancy proof, not demoed): "Palm Gate Real Estate LLC" with 3 customers.
- Watchlist entries (~45, global): real well-known sanctioned names (Osama bin Laden — deceased but on lists historically; use as test chip like the demo did, plus: Vladimir Putin (PEP/sanctions), Bashar al-Assad, Kim Jong-un, Nicolas Maduro, Yahya Sinwar (deceased — fine, historical lists), plus plausible PEPs: e.g. 'Mohammed bin Salman' NO — politically sensitive; skip Gulf royals. Use fictional-but-realistic sanctioned persons and some 'special interest' fictional names in Arabic + English (e.g. 'Dmitry Volkov', 'Viktor Petrov', 'Ali Hassan Nasrallah' no — use clearly list-real: Hassan Nasrallah is a designated person (deceased 2024) — acceptable as list data), 'Anish B Doshi' as US exclusions test entry (matches the demo story), several fictional: 'Rajesh Kumar Malhotra' (fraud watchlist), 'Chen Wei' (sanctions), 'Fatima Al Zahra Karim' (PEP — fictional), plus companies ('Nordwind Trading LLC', 'Crescent Exchange Co'). Include aliases + DOBs so matching demos well. Test chips on Test Screening: Osama Bin Laden / Anish Doshi / Vladimir Putin.
- Customers (~24 for Al Noor): mix of statuses — most pending_kyc (like real onboarding backlog), some active/clear, 2 restricted (confirmed match), a few high risk; Arabic names included (e.g. Jamal Khaled Muhammad Hussein Al-Taie with Emirates ID 784-1990-1234555-1 — from the demo, synthetic); documents with checklists in varied states; ~40 transactions across customers/dates incl. patterns triggering CASH_THRESHOLD (62,000 cash gold buy), STRUCTURING (3 cash ~19,500 within 5 days), HIGH_VALUE (240,000). Create transactions via monitor so tm_alerts exist.
- Alerts: generate by running screening on seeded customers against watchlist (a couple of near-name customers: e.g. customer 'Usama Bin Laden' NO — realistic near matches: 'Osama Bin Laden' as WALK-IN screening-only subject not customer; instead customers 'Vladimir Petrov' (near Putin/Volkov), 'Anish Doshi' spelled 'Aneesh Doshi' as customer creating review alert — mirrors demo). Keep respectful & realistic.
- Cases: 2 open (1 from screening alert escalation, 1 from structuring TM alert), 1 STR draft linked.
- EWRA: one 2026 annual assessment draft with scores.
- Providers for Al Noor: opensanctions enabled, mode realtime, api_key NULL (note shown: add key for live data; local fallback active), threshold 0.70; ofac/eu/un/uk loaded with counts.
- TM rules seeded enabled.
- form_fields seeded with the create-customer field set.

## Notes
- Backend: use Laravel Sanctum (install sanctum if not present). Custom middleware/company scoping via model global scopes on CompanyOwned trait. Keep controllers thin, logic in services. All JSON responses use the envelope. Run `php artisan migrate:fresh --seed` must succeed end-to-end.
- Frontend: axios or fetch wrapper in lib/api.ts with token in localStorage ('cs_token'), 401 -> redirect /login. Keep all pages client components for simplicity except layout basics. `npm run build` must pass.
- Both halves: no TODO stubs; every button wired.
