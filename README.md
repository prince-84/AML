# ComplyShield — AML / CFT Compliance SaaS

A modern, multi-tenant AML / CFT compliance web application designed for DNFBP businesses (jewellery & precious metals, real estate, insurance, audit firms), inspired by international regulatory compliance standards and the UAE goAML framework. Every subscriber company gets an isolated workspace, customer registry, screening engine, transaction monitoring, and audit trail.

- **Frontend:** Next.js 16 + React 19 + Tailwind CSS (`web/`) — Deployed on Vercel
- **Backend:** Laravel 11/13 REST API + Laravel Sanctum (`api/`) — Deployed on Web Hosting / VPS
- **Database:** MySQL / MariaDB (Multi-tenant scoped)

---

## What's Inside

1. **Dashboard**
   - Real-time compliance health, KYC pipeline, pending alerts, active cases, high-risk exposure, and audited activity feeds.
2. **Customer Due Diligence (CDD / KYC)**
   - 3-step customer onboarding wizard with document verification checklist (Emirates ID, Passport, Trade License, etc.).
   - Visual compliance journey, automated risk score calculation (0–100 scale: Low, Medium, High, Severe), and EDD tracking.
3. **Automated Sanctions Screening**
   - Real-time screening against local watchlists (OFAC SDN, EU, UN, UK, UAE lists, PEPs) with fuzzy/phonetic matching.
   - Live OpenSanctions API integration with per-company credits tracking.
   - Batch CSV screening, name checker, and screening alert review/escalation workflow.
4. **Transaction Monitoring & Validation Exceptions**
   - Real-time rules engine: Cash Threshold (≥ AED 55,000), Structuring / Split Cash, High-Risk Customer activity, High Value, and Rapid Succession.
   - Dedicated **Validation Exceptions** audit workspace with KPI overview, multi-parameter filtering, rule trigger explanations, and direct alert decisions (Close benign / Escalate to Case).
5. **Cases & goAML STR/SAR Reporting**
   - Investigation case management for AML compliance officers and MLROs.
   - Suspicious Transaction Report (STR) drafting with automated UAE goAML XML export.
6. **Enterprise-Wide Risk Assessment (EWRA)**
   - 5-factor risk scoring (Customers, Products, Channels, Geography, Counterparties) with residual risk computation.
7. **Form Builder & Company Settings**
   - Dynamic custom onboarding fields, role-based access control (Owner, MLRO, Officer, Viewer), and API usage monitoring.

---

## Local Development Setup

### Prerequisites
- PHP 8.3+ (PHP 8.4 recommended)
- Composer 2.x
- Node.js 20+ & npm
- MySQL 8.x

### 1. Database Setup
```sql
CREATE DATABASE aml_compliance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend Setup (`api/`)
```bash
cd api
composer install
cp .env.example .env   # Configure DB_DATABASE=aml_compliance, DB_USERNAME, DB_PASSWORD
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan serve --port=8000
```
Backend runs at `http://127.0.0.1:8000`.

### 3. Frontend Setup (`web/`)
```bash
cd web
npm install
# web/.env.local contains: NEXT_PUBLIC_API_URL=http://localhost:8000/api
npm run dev
```
Frontend runs at `http://localhost:3000`.

---

## Demo Credentials (Seeded Workspace: Al Noor Gold & Jewellery LLC)

| Role | Email | Password |
| :--- | :--- | :--- |
| **Owner** | `owner@alnoor.example` | `password` |
| **MLRO** (Compliance Manager) | `mlro@alnoor.example` | `password` |
| **Officer** | `officer@alnoor.example` | `password` |
| **Palm Gate Real Estate (Tenant 2)** | `owner@palmgate.example` | `password` |

---

## Production Deployment Guide

### A. Frontend Deployment (Vercel)
The Next.js frontend is designed to deploy on Vercel from the monorepo root:
1. Import repository `prince-84/AML` into Vercel.
2. In **Project Settings → General**:
   - **Root Directory:** Set to `web` *(Mandatory)*.
   - **Framework Preset:** `Next.js`.
3. In **Environment Variables**:
   - `NEXT_PUBLIC_API_URL` = `https://your-backend-domain.com/api` (ensure trailing `/api`).
4. Click **Deploy**.

### B. Backend Deployment (Hosting / VPS)
1. Upload/clone `api/` to hosting document root (e.g. `aml.fsadvisory.ae`).
2. Point web server root to `api/public`.
3. Configure `api/.env`:
   - `APP_ENV=production`, `APP_DEBUG=false`
   - `APP_URL=https://your-backend-domain.com`
   - MySQL database connection settings.
4. Run deployment commands:
   ```bash
   composer install --no-dev --optimize-autoloader
   php artisan key:generate
   php artisan migrate --force --seed
   php artisan storage:link
   php artisan config:cache
   php artisan route:cache
   ```
5. **CORS:** `api/config/cors.php` allows all origins (`*`) for Sanctum Bearer token requests, ensuring Vercel preview and production domains communicate seamlessly with the backend.

---

## Security & Anti-Indexing (NoIndex Policy)

Search engine indexing and crawler discovery are completely disabled across both frontend and backend:
- **Frontend (`web`):**
  - `web/public/robots.txt`: Blocks all crawlers (`Disallow: /`).
  - `web/src/app/layout.tsx`: Root `<meta name="robots" content="noindex, nofollow, noarchive" />`.
  - `web/next.config.ts` & `web/vercel.json`: Edge-level `X-Robots-Tag: noindex, nofollow, noarchive` headers.
- **Backend (`api`):**
  - `api/public/robots.txt`: Disallow all crawlers (`Disallow: /`).
  - `api/public/.htaccess`: Directory listing disabled (`Options -Indexes`) and `X-Robots-Tag` header enforced.
  - `api/app/Http/Middleware/NoIndexHeaders.php`: Global middleware appending `X-Robots-Tag: noindex, nofollow, noarchive` on all JSON and web responses.
  - `api/routes/web.php`: Root path `/` returns an API status JSON instead of public landing pages.

---

## Project Structure

```
├── AGENTS.md                  # Workflow & agent maintenance rules
├── CONTRACT.md                # Full functional specification & schema
├── README.md                  # System documentation & changelog (this file)
├── .gitignore                 # Root gitignore excluding .env, vendor, node_modules, logs
│
├── api/                       # Laravel 11/13 REST API backend
│   ├── app/
│   │   ├── Http/Controllers/  # Controllers (Transactions, Customers, Screening, etc.)
│   │   ├── Http/Middleware/   # Custom middleware (NoIndexHeaders)
│   │   ├── Models/            # Multi-tenant Eloquent models
│   │   └── Services/          # AML Engines (Screening, Risk, Monitor, GoAML)
│   ├── config/cors.php        # CORS configuration
│   ├── database/              # Migrations and Demo seeders
│   └── routes/api.php         # Authenticated API endpoints
│
└── web/                       # Next.js 16 frontend application
    ├── public/                # Static assets and robots.txt
    ├── vercel.json            # Vercel deployment edge headers
    └── src/
        ├── app/               # App Router pages and layouts
        ├── components/        # UI library, Modals, Decision tools, Shell
        └── lib/               # API client, auth context, types, formatters
```

---

## Changelog & Recent Updates

### November 12, 2026
- **CORS Preflight Fix:** Fixed preflight regex crash in `api/config/cors.php` by removing invalid `allowed_origins_patterns` wildcard, allowing full cross-origin Bearer token authentication from Vercel (`*.vercel.app`) to production hosting (`aml.fsadvisory.ae`).
- **Comprehensive NoIndex Implementation:** Configured complete crawler blocking (`robots.txt`, HTML meta tags, middleware, Apache `.htaccess`, Next.js headers, and `vercel.json`) across both frontend and backend.
- **Root Documentation & Agent Policy:** Added `AGENTS.md` establishing the mandatory rule to update `README.md` on every change.

### November 11, 2026
- **Validation Exceptions Workspace:** Upgraded `web/src/app/(app)/transactions/page.tsx` with summary KPI stat cards, multi-parameter rule/status/method filters, readable rule tags (Cash Threshold, Structuring, High-Risk Customer), customer risk badges, and direct alert decision workflows (`TmAlertDecisionModal`).
- **Backend Search & Analytics:** Added `GET /api/transactions/stats` endpoint and expanded `TransactionController::index` to search across transaction references, item descriptions, and customer names.
- **Next.js 16 Build Stability:** Removed experimental partial prefetching flags causing dropped segment rendering warnings in Turbopack.

### November 10, 2026
- Initialized full local development environment, database migrations, and seeded demo accounts.
