# ComplyShield — AML / CFT Compliance SaaS

A multi-tenant AML compliance web app for DNFBP businesses (jewellery & precious metals, real estate, insurance, audit firms), modelled on the Scantero360 product. Every subscriber company gets its own workspace, customers, screening data and audit trail.

- **Frontend:** Next.js + Tailwind CSS (`web/`) — light theme, Plus Jakarta Sans + Inter
- **Backend:** Laravel API + Sanctum (`api/`)
- **Database:** MySQL / MariaDB

## What's inside

- **Dashboard** — customers, KYC waiting, open alerts, cases, high-risk customers, screening volume, KYC pipeline, pipeline status, recent audited activity
- **Customers** — 3-step add wizard (details → documents → review) with phone QR-scan popup, ID document records with a 6-point verification checklist, customer profile with a visual compliance journey, KYC approve/reject (MLRO/Owner), automatic screening on save, automatic risk score
- **Screening** — Name Checker + Test screening, Bulk screening (CSV), Screening Configuration (OpenSanctions + OFAC/EU/UN/UK providers), Screening Alerts with decision workflow (false positive / confirm match / escalate to case), Adverse Media, Screening Monitor
- **Transaction Monitoring** — transactions ledger, 6 built-in rules (cash threshold AED 55,000, structuring, high value, rapid succession, high-risk customer, dormant spike), alerts with decisions, editable rules
- **Cases & Reports** — investigation cases, STR/SAR drafts generated from a case with a goAML-format XML export, MLRO mark-as-filed
- **Risk** — EWRA (enterprise-wide risk assessment) with 5 scored dimensions and residual risk, Risk Register (high/severe customers)
- **Settings** — company profile, users & roles (Owner / MLRO / Officer / Viewer), Customer Form Builder, subscription & OpenSanctions usage
- **SaaS** — full tenant isolation: every record is scoped to the logged-in company

## Run it locally

Requirements: PHP 8.3+, Composer, Node 20+, MySQL/MariaDB.

```bash
# 1) Database
mysql -uroot -e "CREATE DATABASE complyshield; CREATE USER 'complyshield'@'127.0.0.1' IDENTIFIED BY 'cs_dev_2026_local'; GRANT ALL ON complyshield.* TO 'complyshield'@'127.0.0.1';"

# 2) Backend
cd api
composer install
cp .env.example .env   # set DB_DATABASE=complyshield, DB_USERNAME=complyshield, DB_PASSWORD=cs_dev_2026_local
php artisan key:generate
php artisan migrate:fresh --seed
php artisan serve --port=8000

# 3) Frontend (new terminal)
cd web
npm install
npm run build && npm run start   # or: npm run dev
```

Open http://localhost:3000

## Demo accounts (seeded workspace: Al Noor Gold & Jewellery LLC, Dubai)

| Role    | Email                 | Password |
| ------- | --------------------- | -------- |
| Owner   | owner@alnoor.example  | password |
| MLRO    | mlro@alnoor.example   | password |
| Officer | officer@alnoor.example| password |

A second tenant (Palm Gate Real Estate LLC) is seeded to prove tenant isolation.

## OpenSanctions live data

Screening works out of the box against the built-in local watchlist (OFAC, EU, UN, UK and PEP entries) with a fuzzy/phonetic matching engine. For live OpenSanctions data:

1. Sign up at https://www.opensanctions.org — a business email starts a free trial API key.
2. In the app: **AML Screening → Screening Configuration → OpenSanctions → paste the API key → Save**.
3. From that moment, checks run in real time against OpenSanctions (each call is counted under Settings → Subscription & Usage). Without a key the app keeps using the local lists — nothing breaks.

**Deployment-wide key (for the operator):** instead of pasting a key per company, set `OPENSANCTIONS_API_KEY` once in `api/.env` and restart the API. Every company then screens live with that key, unless a company saves its own key in Screening Configuration — the company's own key and its on/off toggle always win.

Note: OpenSanctions' free data licence is non-commercial; a paid licence is required before selling live screening as a service.

## Layout

- `CONTRACT.md` — the full build specification both halves were built against
- `api/` — Laravel application (migrations, services: ScreeningService, OpenSanctionsService, RiskService, TransactionMonitor, GoAmlService)
- `web/` — Next.js application
