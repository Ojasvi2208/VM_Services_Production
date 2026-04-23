# QA Master Test Plan — vmfinancialservices.com

**Target**: https://www.vmfinancialservices.com (Next.js 15, Vercel, Railway Postgres)
**Style**: Google-grade manual QA. No automation. Every case executed by hand.
**Scope**: Unit-equivalent (input→output function traces), integration (API contracts),
E2E user journeys, smoke, sanity, regression, performance, load/stress, accessibility,
security, SEO/AdSense, compliance. No test category skipped.

**How to use**: work top to bottom. Mark each case `PASS` / `FAIL` / `BLOCKED` / `SKIP (reason)`
in the status column. Log defects at the end. Sign off only when every `FAIL` has a linked
issue number.

**Tester**: _____________________  **Environment**: Production  **Date**: _________
**Build**: Git SHA _____________________  **Browser matrix**: Chrome 130 stable (primary),
Safari 18 (desktop + iOS), Firefox 130, Edge, one mid-tier Android (Moto Edge 30)

---

## 0. Pre-flight

| # | Check | Expected | Status |
|---|---|---|---|
| 0.1 | DNS resolves | `nslookup www.vmfinancialservices.com` returns A record | |
| 0.2 | TLS valid | Chrome padlock; cert issuer = Let's Encrypt or Sectigo; expiry > 30 days | |
| 0.3 | Vercel deployment green | Vercel dashboard "Ready" on latest commit | |
| 0.4 | Railway DB reachable | /api/funds/autocomplete?q=hdfc returns 200 with suggestions | |
| 0.5 | CF Relay reachable | /api/market-data returns live Nifty quote (not cached) | |

---

## 1. Unit-Level Manual Traces (critical lib/ functions)

Manual "unit tests" = walk through the function with specific inputs, verify output. Pull
the function, paste example inputs in a Node REPL or TS playground, compare output to
expected. No framework — just the tester and the math.

### 1.1 LTCG tax calculation (`src/lib/tax-calculator.ts`)

Execute each case by opening a Node REPL (`node`), `require('./src/lib/tax-calculator')`,
and invoking with the exact inputs below.

| # | Function | Input | Expected output | Notes | Status |
|---|---|---|---|---|---|
| 1.1.1 | `computeEquityLTCG` | gain = ₹1,00,000, fy = 2025-26 | tax = 0 (below ₹1.25L exemption) | FY 2025-26 exemption = ₹1.25L | |
| 1.1.2 | `computeEquityLTCG` | gain = ₹1,25,000, fy = 2025-26 | tax = 0 (exactly at exemption) | Boundary | |
| 1.1.3 | `computeEquityLTCG` | gain = ₹1,25,001, fy = 2025-26 | tax = ₹0.125 rounded → ₹1 | Just above exemption | |
| 1.1.4 | `computeEquityLTCG` | gain = ₹5,00,000, fy = 2025-26 | tax = (5L − 1.25L) × 12.5% = ₹46,875 | Normal case | |
| 1.1.5 | `computeEquityLTCG` | gain = ₹0, fy = 2025-26 | tax = 0 | Zero input | |
| 1.1.6 | `computeEquityLTCG` | gain = −₹50,000, fy = 2025-26 | tax = 0 (loss) | Negative input | |
| 1.1.7 | `computeEquitySTCG` | gain = ₹1,00,000, fy = 2025-26 | tax = ₹20,000 (20%) | Post-July-2024 rate | |
| 1.1.8 | `computeDebtLTCG` | gain = ₹2L, purchased ≥1-Apr-2023, slab = 30% | tax at slab = ₹60,000 + 4% cess = ₹62,400 | Post-April-2023 rule | |
| 1.1.9 | `computeDebtLTCG` | gain = ₹2L, purchased 15-Mar-2023, held 36 months | tax = ₹25,000 (12.5% flat, no indexation) | Pre-Apr-2023 legacy rule | |
| 1.1.10 | All tax functions | gain = `NaN` | Should reject with error, not return `NaN` | Defensive path | |

### 1.2 XIRR (`src/lib/xirr.ts`)

| # | Input | Expected | Notes | Status |
|---|---|---|---|---|
| 1.2.1 | Single deposit ₹1L on day 0, redeem ₹1.1L after 365 days | XIRR ≈ 10% | Sanity | |
| 1.2.2 | ₹10k monthly SIP for 12 months, redeem ₹1.3L | XIRR ≈ 24% | Real world | |
| 1.2.3 | All flows positive (no outflow) | Returns NaN or throws | Impossible case | |
| 1.2.4 | All flows zero | Returns 0 or NaN | Degenerate | |
| 1.2.5 | Two flows same date | Handles correctly | Duplicate-date edge case | |
| 1.2.6 | Flow in 1970 + flow in 2026 | Converges within 1000 iterations | 56-year span | |

### 1.3 Monte Carlo (`src/lib/monte-carlo.ts`)

| # | Input | Expected | Notes | Status |
|---|---|---|---|---|
| 1.3.1 | σ = 0, μ = 10%, 10-year horizon, 10k paths | All paths terminate at same deterministic value; success prob 100% if target below, 0% if above | Zero-vol degenerate | |
| 1.3.2 | σ = 18%, μ = 12%, 15-year horizon, 10k paths | Success prob between 0.4 and 0.85 for target corpus = 2× monthly-SIP-based projection | Realistic | |
| 1.3.3 | Horizon = 0 months | Returns starting corpus; success prob based on threshold match | Boundary | |
| 1.3.4 | Negative μ | Paths decline on average; success prob near 0 for any target above starting corpus | Defensive | |
| 1.3.5 | Same seed twice | Identical output (if seeded) OR different output (if not seeded) — document which | Determinism check | |

### 1.4 Returns calculator (`src/lib/returns-calculator.ts`)

| # | Input | Expected | Status |
|---|---|---|---|
| 1.4.1 | NAV 100 → 150 over exactly 1 year | CAGR = 50%, absolute = 50% | |
| 1.4.2 | NAV 100 → 100 over 5 years | CAGR = 0 | |
| 1.4.3 | NAV 100 → 50 over 2 years | CAGR ≈ −29.3% | |
| 1.4.4 | Rolling 5Y returns on 3-year-old fund | Returns empty array or error | Insufficient data | |
| 1.4.5 | NAVs with missing dates (gaps) | Interpolates or skips; no crash | Real-world data | |

### 1.5 Fund categorisation (`src/lib/fund-categorization.ts`)

| # | Scheme name | Expected category | Status |
|---|---|---|---|
| 1.5.1 | "HDFC Large Cap Fund - Direct Growth" | Large Cap | |
| 1.5.2 | "Mirae Asset Tax Saver Fund" | ELSS | |
| 1.5.3 | "ICICI Prudential Liquid Fund" | Liquid | |
| 1.5.4 | "HDFC Equity Opp Fund - II - 1126D May 2017" | FMP / matured (should be filterable) | |
| 1.5.5 | Empty string | Returns "Unknown" or null, no crash | |
| 1.5.6 | 2000-char garbage | Returns "Unknown", no perf hang | |

---

## 2. Integration-Level Manual API Tests

Use `curl` or Postman. Record status code, response time, body shape.

### 2.1 Public read endpoints (no auth)

| # | Method + URL | Expected status | Expected shape / value | Status |
|---|---|---|---|---|
| 2.1.1 | GET `/api/funds/search?q=hdfc&limit=10` | 200 | `{ success: true, funds: [...] }`, length ≤ 10 | |
| 2.1.2 | GET `/api/funds/search?q=` | 200 or 400 | Empty array or validation error | |
| 2.1.3 | GET `/api/funds/search?q=a` (1 char) | 200 or 400 | Reject if <2 chars | |
| 2.1.4 | GET `/api/funds/search?q=' OR 1=1--` | 200 | No SQL injection — parametrised query | |
| 2.1.5 | GET `/api/funds/autocomplete?q=hdf` | 200 | ≤8 grouped suggestions; no dup Direct/Regular | |
| 2.1.6 | GET `/api/funds/120716` (valid scheme code) | 200 | Full fund detail JSON | |
| 2.1.7 | GET `/api/funds/0` (invalid) | 404 | | |
| 2.1.8 | GET `/api/funds/141429` (HDFC 1126D matured FMP) | 200 | Returns NAV frozen 2022-01-14; page should still render but flag staleness | |
| 2.1.9 | GET `/api/market-data` | 200 | Nifty quote, ≤ 2s response | |
| 2.1.10 | GET `/api/market-data/gift-nifty` | 200 | GIFT Nifty quote | |
| 2.1.11 | GET `/api/commodities` | 200 | 11 commodities | |
| 2.1.12 | GET `/api/corporate-actions` | 200 | Dividends + earnings | |
| 2.1.13 | GET `/api/news/aggregated` | 200 | 8 categories | |
| 2.1.14 | GET `/api/fuel-prices?state=Delhi` | 200 | Petrol/diesel/CNG for Delhi | |
| 2.1.15 | GET `/api/nfo/live` | 200 | Recently launched funds | |
| 2.1.16 | GET `/api/mutual-fund-data?limit=10` | 200 | 10 top-quality funds | |
| 2.1.17 | GET `/api/currency-rates` | 200 | Fiat-to-INR rates | |
| 2.1.18 | GET `/api/stocks/gainers-losers` | 200 | NSE top gainers/losers | |
| 2.1.19 | GET `/sitemap.xml` | 200 | XML valid; ≥70 `<loc>` entries | |
| 2.1.20 | GET `/robots.txt` | 200 | Disallow /api/, /auth/, /admin/, /premium | |

### 2.2 Auth endpoints

| # | Case | Expected | Status |
|---|---|---|---|
| 2.2.1 | POST `/api/auth/signin` with valid credentials | 200 + session cookie | |
| 2.2.2 | POST `/api/auth/signin` with wrong password | 401 (not 500, not 200) | |
| 2.2.3 | POST `/api/auth/signin` with nonexistent email | 401 (same response as 2.2.2 — timing-safe) | |
| 2.2.4 | POST `/api/auth/signin` with SQL injection in email | 400 validation error | |
| 2.2.5 | GET `/api/auth/session` unauthenticated | 401 | |
| 2.2.6 | GET `/api/auth/session` authenticated | 200 with user object | |
| 2.2.7 | GET `/api/auth/google` | 302 to accounts.google.com with `state` cookie | |
| 2.2.8 | GET `/api/auth/google/callback` without state cookie | 400 CSRF guard triggers | |
| 2.2.9 | GET `/api/auth/google/callback` with mismatched state | 400 | |
| 2.2.10 | POST `/api/auth/signout` | 200 + clears cookie | |

### 2.3 Protected endpoints

| # | Case | Expected | Status |
|---|---|---|---|
| 2.3.1 | GET `/api/user/portfolio` unauthenticated | 401 | |
| 2.3.2 | GET `/api/user/portfolio` authenticated | 200 with holdings | |
| 2.3.3 | POST `/api/portfolio/import-cas` without file | 400 | |
| 2.3.4 | POST `/api/portfolio/import-cas` with 10MB PDF | Processes or 413 Payload Too Large | |
| 2.3.5 | POST `/api/portfolio/import-cas` with non-PDF (a .jpg renamed .pdf) | 400 validation error, not crash | |
| 2.3.6 | GET `/api/portfolio/tax-impact?year=2025` authenticated | 200 with LTCG/STCG | |
| 2.3.7 | Any protected endpoint with expired session | 401, not 500 | |

### 2.4 Admin endpoints (require admin auth)

| # | Case | Expected | Status |
|---|---|---|---|
| 2.4.1 | GET `/admin/claims` as non-admin | 403 or redirect to /auth/signin | |
| 2.4.2 | POST `/api/admin/set-premium` as non-admin | 403 | |
| 2.4.3 | `/admin/*` routes appear in robots.txt Disallow | Confirmed in robots.txt | |

### 2.5 Cron endpoints (require `CRON_SECRET`)

| # | Case | Expected | Status |
|---|---|---|---|
| 2.5.1 | GET `/api/cron/daily-update` without secret | 401 | |
| 2.5.2 | GET `/api/cron/daily-update` with wrong secret | 401 | |
| 2.5.3 | GET `/api/cron/daily-update` with correct secret | 200 + job started | |
| 2.5.4 | Cron route in prod uses `runtime = 'nodejs'` (not edge) if DB-heavy | Check each cron route file | |

---

## 3. End-to-End User Journeys (manual browser clicks)

Each journey: open an incognito/private window, execute the clicks in order, record status.
Retry each journey on one mobile device (Android Chrome) and note if behaviour diverges.

### 3.1 First-time visitor: discover a fund

| Step | Action | Expected | Status |
|---|---|---|---|
| 1 | Visit `/` | Homepage loads < 2.5s LCP, shows hero + Top Funds grid | |
| 2 | Click "Top Performing Funds" → click the 1st card | Navigates to `/funds/<code>` | |
| 3 | Fund detail page renders | Scheme name, NAV, 3Y return all visible | |
| 4 | Scroll to Holdings section | Shows top 10 stocks (or "data not available") | |
| 5 | Toggle Direct ↔ Regular | Page updates with different scheme code or NAV | |
| 6 | Click "Back" browser button | Returns to homepage, scroll preserved | |

### 3.2 Search a specific fund

| Step | Action | Expected | Status |
|---|---|---|---|
| 1 | Type "parag parikh" in search bar | Autocomplete dropdown shows within 300ms | |
| 2 | Select "Parag Parikh Flexi Cap Fund - Direct Growth" | Navigates to the fund detail | |
| 3 | Verify latest NAV is within last 5 business days | If stale, mark bug | |

### 3.3 Read a blog post

| Step | Action | Expected | Status |
|---|---|---|---|
| 1 | Visit `/blog` | Index renders 12 posts, newest first | |
| 2 | Click "LTCG and STCG on Equity Mutual Funds in 2026" | Navigates to the post | |
| 3 | View source | Unique `<title>` tag; `<meta description>`; JSON-LD Article schema | |
| 4 | Scroll through | Tables, bullets, strong tags all render | |
| 5 | Click "Ojasvi Malik" byline | Navigates to `/author/ojasvi-malik` | |
| 6 | Author page | ARN-317605 visible; Person JSON-LD present | |
| 7 | Click a related post | Navigates correctly; no 404 | |

### 3.4 Use SIP calculator

| Step | Action | Expected | Status |
|---|---|---|---|
| 1 | Visit `/calculators/sip` | Form loads | |
| 2 | Enter monthly = ₹10,000, years = 20, return = 12% | Result shows ≈ ₹1.0 cr | |
| 3 | Enter 0 monthly | Shows 0 or validation error | |
| 4 | Enter −₹10,000 | Rejects (validation) | |
| 5 | Enter 100,000 years | Rejects or caps gracefully | |
| 6 | Return = 50% | AMFI cap at 13% applies or error | |
| 7 | Chart renders without clip/overflow | Visual check | |

### 3.5 Sign up + sign in (email)

| Step | Action | Expected | Status |
|---|---|---|---|
| 1 | `/auth/signup` | Form loads | |
| 2 | Submit with weak password "abc" | Rejected client-side | |
| 3 | Submit with valid input | Redirects to dashboard or verification page | |
| 4 | Check inbox for verification email | Received < 60s | |
| 5 | Click verification link | Email marked verified | |
| 6 | Sign out | Session cleared | |
| 7 | Sign in with same credentials | Succeeds | |
| 8 | Sign in with wrong password 5 times | Rate-limited or lockout warning | |

### 3.6 Google sign-in

| Step | Action | Expected | Status |
|---|---|---|---|
| 1 | Click Google button on `/auth/signin` | Redirects to Google consent | |
| 2 | Grant consent | Redirects back to `/dashboard` | |
| 3 | Verify user is created in DB (check dashboard name/email) | Matches Google account | |
| 4 | Tamper with `state` cookie before callback | Rejected with CSRF error | |

### 3.7 Import CAS → portfolio appears

| Step | Action | Expected | Status |
|---|---|---|---|
| 1 | Login → `/portfolio` → "Import CAS" | Upload widget shown | |
| 2 | Upload valid CAMS/Karvy CAS PDF | Progress → "Processing" → redirects with parsed holdings | |
| 3 | Upload wrong PDF (password-protected without password) | Error message, not crash | |
| 4 | Upload 40MB CAS | Handled or proper size limit error | |
| 5 | Verify PII (PAN) is not echoed in any UI or console.log | Check Network tab + console | |
| 6 | Holdings reflect real fund names (no "Unknown") | Visual | |

### 3.8 Create and delete a goal

| Step | Action | Expected | Status |
|---|---|---|---|
| 1 | `/goals` → "Create Goal" | Form sheet opens | |
| 2 | Enter goal name, target, deadline, monthly SIP | Validates | |
| 3 | Submit | Goal appears in list | |
| 4 | Click goal tile | Opens `/goals/<id>` | |
| 5 | Verify back button returns to `/goals` with single tap | (Not 3 taps — previous bug fixed) | |
| 6 | Long-press goal → Delete | Confirm + delete; goal removed | |
| 7 | Refresh page | Deleted goal does not reappear (Hive cache invalidated) | |

### 3.9 Contact form submission

| Step | Action | Expected | Status |
|---|---|---|---|
| 1 | `/contact` | Form loads | |
| 2 | Submit without filling required fields | Client validation | |
| 3 | Submit with 10k-character message | Handles or length-limited | |
| 4 | Submit with `<script>` in message | Escaped; no XSS in confirmation | |
| 5 | Submit valid message | Success state; email arrives at grievance@ (or configured inbox) | |

### 3.10 Compare two funds

| Step | Action | Expected | Status |
|---|---|---|---|
| 1 | `/compare` | Tool loads | |
| 2 | Pick Fund A = large-cap index, Fund B = active large-cap | Comparison renders | |
| 3 | Check overlap percentage | Numeric value 0–100% | |
| 4 | Check alpha/beta/Sharpe on both | Populated | |
| 5 | Pick same fund on both sides | Overlap = 100%, other metrics sensible | |

---

## 4. Smoke Tests (every deploy)

Run these within 5 minutes of every production deploy.

| # | Route | Check | Status |
|---|---|---|---|
| 4.1 | `/` | HTTP 200, `<title>` includes "Vijay Malik" | |
| 4.2 | `/blog` | 200, ≥12 post cards | |
| 4.3 | `/funds/120716` | 200, displays NAV | |
| 4.4 | `/markets/NIFTY` | 200, live price | |
| 4.5 | `/author/ojasvi-malik` | 200, ARN visible | |
| 4.6 | `/calculators/sip` | 200, form loads | |
| 4.7 | `/api/funds/search?q=hdfc` | 200 JSON | |
| 4.8 | `/api/market-data` | 200, price not null | |
| 4.9 | `/sitemap.xml` | 200, ≥70 `<loc>` | |
| 4.10 | `/robots.txt` | 200, contains `Disallow: /premium` | |

---

## 5. Sanity Tests (before any release)

| # | Check | Method | Status |
|---|---|---|---|
| 5.1 | Latest NAV date in DB ≤ 2 business days old | `SELECT MAX(latest_nav_date) FROM funds WHERE is_active = true` | |
| 5.2 | Cron `daily-update` ran last 24h | Vercel cron dashboard | |
| 5.3 | No errored Vercel functions last 24h | Vercel logs | |
| 5.4 | Sitemap URLs match route existence | `xargs curl -sI` through every `<loc>` | |
| 5.5 | Search index (mv_unified_search) row count > 10,000 | DB query | |

---

## 6. Regression Tests (after any code change)

Always re-run these after any change, even a typo fix in an unrelated file.

| # | Area | Case | Status |
|---|---|---|---|
| 6.1 | Homepage | Hero loads + word count in HTML > 600 (AdSense gate) | |
| 6.2 | Direct/Regular toggle | On any fund page, toggle changes scheme code + NAV | |
| 6.3 | Fund detail crash | Scheme with numeric `min_sip` renders without "int is not subtype of String" | |
| 6.4 | Goal creation | Created goal visible immediately and after tab switch | |
| 6.5 | Matured FMP | HDFC 1126D May 2017 NOT in sitemap.xml; NOT in `/api/funds/top-performers` | |
| 6.6 | Blog metadata | Every post has unique `<title>`, `<meta description>`, Article JSON-LD | |
| 6.7 | Markets fade-through nav | Tab switch completes < 200ms | |
| 6.8 | LTCG calculator | ₹1.25L boundary produces 0 tax, ₹1.26L produces ₹125 | |
| 6.9 | Tax regime | New regime default; ₹12.75L zero-tax threshold correctly shown | |
| 6.10 | Pool exhaustion | Run 20 concurrent requests to /api/funds/search — no 500s, no "connection refused" | |

---

## 7. Performance Tests

### 7.1 Lighthouse (Chrome DevTools → Lighthouse)

Run on each page, desktop + mobile presets. Accept only scores ≥ targets.

| Page | Performance | Accessibility | Best Prac. | SEO | Status |
|---|---|---|---|---|---|
| `/` | ≥ 85 | ≥ 95 | ≥ 95 | 100 | |
| `/blog` | ≥ 85 | ≥ 95 | ≥ 95 | 100 | |
| `/blog/ltcg-stcg-equity-mutual-funds-2026` | ≥ 90 | ≥ 95 | ≥ 95 | 100 | |
| `/funds/120716` | ≥ 75 | ≥ 95 | ≥ 95 | 100 | |
| `/markets` | ≥ 75 | ≥ 95 | ≥ 95 | 100 | |
| `/author/ojasvi-malik` | ≥ 90 | ≥ 95 | ≥ 95 | 100 | |

### 7.2 Core Web Vitals (DevTools → Performance)

Measured on a throttled Fast 3G profile, mid-tier Android.

| Metric | Target | Page(s) | Status |
|---|---|---|---|
| LCP | < 2.5s | All | |
| CLS | < 0.10 | All | |
| INP | < 200ms | All | |
| TBT | < 300ms | All | |
| TTFB | < 800ms | All | |

### 7.3 Network payload

| # | Check | Target | Status |
|---|---|---|---|
| 7.3.1 | Homepage total transfer | < 1 MB | |
| 7.3.2 | Blog post HTML size | < 200 KB | |
| 7.3.3 | `/funds/<code>` first payload | < 1 MB (including charts) | |
| 7.3.4 | Number of 3rd-party requests per page | ≤ 10 | |
| 7.3.5 | JS bundle (main chunk) | < 300 KB gzipped | |

### 7.4 Server timing

`curl -w '%{time_total}\n' -o /dev/null -s <url>` on each:

| URL | Target | Status |
|---|---|---|
| `/` | < 500ms | |
| `/api/funds/search?q=hdfc` | < 300ms | |
| `/api/funds/autocomplete?q=hdf` | < 150ms (MV hit) | |
| `/api/funds/120716` | < 500ms | |
| `/api/market-data` | < 1200ms (CF relay involved) | |
| `/sitemap.xml` | < 2s (DB query) | |

---

## 8. Load / Stress Tests (localhost only)

Run `npm run dev` locally + hit localhost:3000. **Never run against prod.**

### 8.1 Light load (sanity)

Open 10 browser tabs to different pages simultaneously. Watch for:
- Any 500 errors in Vercel dev log
- Any Postgres "too many connections" in Railway log
- Any page that visibly freezes

Status: ____

### 8.2 Medium load (Apache Bench)

```bash
# Install: brew install apache2 (or apt-get install apache2-utils)
ab -n 1000 -c 10 http://localhost:3000/
ab -n 500  -c 10 http://localhost:3000/api/funds/search?q=hdfc
ab -n 500  -c 10 http://localhost:3000/api/funds/autocomplete?q=hdf
ab -n 100  -c 5  http://localhost:3000/api/funds/120716
```

Record: requests/sec, mean latency, 95th percentile, failed requests.

| Endpoint | Req/s | Mean ms | p95 ms | Failures | Status |
|---|---|---|---|---|---|
| `/` | | | | | |
| `/api/funds/search` | | | | | |
| `/api/funds/autocomplete` | | | | | |
| `/api/funds/120716` | | | | | |

### 8.3 Stress test (find the breaking point)

```bash
ab -n 5000 -c 50 http://localhost:3000/api/funds/search?q=hdfc
```

Increase `-c` (concurrency) in steps of 10 until first 500 error appears. Record that
number as the single-instance concurrency ceiling. Below that is safe; above that
starts degrading.

**Breaking concurrency**: _____  **Cause**: _____ (pool exhaustion? Next.js fn timeout?)

### 8.4 Memory / leak check

Open Chrome DevTools Performance Monitor. Navigate between 20 pages over 5 minutes.
Watch JS heap size. A continuously rising heap = memory leak.

**Heap growth over 5 min**: _____  **Leak detected**: Y / N

### 8.5 DB pool stress

With `pool.max = 3`, open 10 concurrent browser tabs each triggering `/api/funds/search`.
Check dev log for "remaining connection slots" or timeout. The pool should handle it via
queueing — not fail.

Status: ____

---

## 9. Accessibility (manual + axe DevTools)

### 9.1 Keyboard navigation

| # | Case | Expected | Status |
|---|---|---|---|
| 9.1.1 | Tab through homepage | Focus visible on every interactive element; logical order | |
| 9.1.2 | Skip-to-content link | Present (test via Tab on page load) | |
| 9.1.3 | Modal open → Escape closes it | All modals respond to ESC | |
| 9.1.4 | Form fields reachable via Tab | No keyboard trap | |
| 9.1.5 | Dropdown / combobox arrow keys work | Autocomplete, date pickers | |

### 9.2 Screen reader (VoiceOver on macOS, TalkBack on Android)

| # | Case | Expected | Status |
|---|---|---|---|
| 9.2.1 | Every image has alt text | Announced or marked decorative | |
| 9.2.2 | Every icon button has aria-label | Announced purpose | |
| 9.2.3 | Form labels associated with inputs | Announced together | |
| 9.2.4 | Page title announced on load | Not generic "Document" | |
| 9.2.5 | Error messages have role="alert" | Announced on submit | |

### 9.3 Colour contrast (axe DevTools Chrome extension)

Run axe on every page listed in §7.1. Zero critical/serious contrast violations.

| Page | Violations | Status |
|---|---|---|
| `/` | | |
| `/blog/ltcg-stcg-equity-mutual-funds-2026` | | |
| `/funds/120716` | | |

### 9.4 Zoom + reflow

Chrome → 200% zoom on all pages. No horizontal scroll; all text readable; no clipped content.
Mobile portrait (360px wide) — same requirement.

Status: ____

### 9.5 Reduced motion

macOS: Settings → Accessibility → Reduce Motion. Reload. Animations respect the preference
(or at minimum don't cause vestibular distress).

Status: ____

---

## 10. Security Tests

### 10.1 Content Security Policy

| # | Check | Expected | Status |
|---|---|---|---|
| 10.1.1 | Response headers include `Content-Security-Policy` | Yes | |
| 10.1.2 | CSP disallows `unsafe-inline` for scripts (or uses nonce) | Yes, or documented exception | |
| 10.1.3 | `X-Frame-Options: DENY` or `frame-ancestors 'none'` | Set (prevents clickjacking) | |
| 10.1.4 | `X-Content-Type-Options: nosniff` | Set | |
| 10.1.5 | `Strict-Transport-Security` (HSTS) with max-age ≥ 15552000 | Set in prod | |
| 10.1.6 | `Referrer-Policy: strict-origin-when-cross-origin` | Set | |
| 10.1.7 | `Permissions-Policy` present | Set (restricts camera, mic, etc.) | |

### 10.2 Authentication and session

| # | Check | Expected | Status |
|---|---|---|---|
| 10.2.1 | Session cookie has `HttpOnly` | Yes | |
| 10.2.2 | Session cookie has `Secure` in prod | Yes | |
| 10.2.3 | Session cookie has `SameSite=Lax` or Strict | Yes | |
| 10.2.4 | Logout invalidates server-side session (not just client cookie) | Yes | |
| 10.2.5 | Session rotation after login | Yes | |
| 10.2.6 | Session rotation after privilege change (e.g., becoming premium) | Yes | |
| 10.2.7 | OAuth state cookie cryptographically random (≥ 128 bits) | Yes (crypto.randomBytes(32)) | |
| 10.2.8 | Password hash uses bcrypt/argon2 with cost ≥ 10 | Yes (inspect DB) | |

### 10.3 Authorisation

| # | Check | Expected | Status |
|---|---|---|---|
| 10.3.1 | User A cannot fetch User B's portfolio via `/api/user/portfolio?userId=B` | 401 or 403 | |
| 10.3.2 | User A cannot delete User B's goal via direct API call | 403 | |
| 10.3.3 | User A cannot view User B's CAS data | 403 | |
| 10.3.4 | Non-admin cannot access `/admin/*` | 403 | |
| 10.3.5 | Expired premium user loses access to Pro features | Yes | |

### 10.4 Input validation

| # | Attack | Endpoint | Expected | Status |
|---|---|---|---|---|
| 10.4.1 | SQL injection `' OR 1=1 --` | Every search/filter param | Parametrised; no exec | |
| 10.4.2 | XSS `<script>alert(1)</script>` | Contact form, profile name, goal name | Escaped in output HTML | |
| 10.4.3 | Stored XSS via profile update | Profile page view after malicious update | Escaped | |
| 10.4.4 | Path traversal `../../etc/passwd` | Any file-path param | Rejected | |
| 10.4.5 | Command injection | CAS upload filename containing `; rm -rf /` | Sanitised | |
| 10.4.6 | Prototype pollution via JSON body | Any POST route | Express/Next.js default guards; explicit check | |
| 10.4.7 | XXE in uploaded PDF | CAS import | pdf-lib/pdf-parse; no XML entities evaluated | |
| 10.4.8 | SSRF via redirect param | OAuth callback; any redirect | Whitelist; no arbitrary external URL | |

### 10.5 Rate limiting

| # | Check | Expected | Status |
|---|---|---|---|
| 10.5.1 | Brute-force login (50 attempts/sec) | Blocked or rate-limited after ~10 | |
| 10.5.2 | OTP brute-force (1000 attempts) | Rate-limited, OTP locked after 5 | |
| 10.5.3 | Public API flood | `/api/funds/search` rate-limited per IP or degrades gracefully | |
| 10.5.4 | Signup flood (automated new accounts) | Captcha or rate limit | |

### 10.6 Dependency scan

```bash
npm audit --production
```

| Severity | Count | Action | Status |
|---|---|---|---|
| Critical | | Must fix before release | |
| High | | Must fix within 7 days | |
| Moderate | | Fix in next sprint | |
| Low | | Backlog | |

### 10.7 Secrets scan

`git log -p | grep -iE 'API_KEY|SECRET|PASSWORD|PRIVATE_KEY|BEGIN RSA|DATABASE_URL'`
No unredacted secrets in git history.

Status: ____

### 10.8 Third-party risks

| # | Check | Status |
|---|---|---|
| 10.8.1 | Every third-party script loaded over HTTPS | |
| 10.8.2 | Every third-party script SRI-pinned if on CDN | |
| 10.8.3 | ads.txt only references Google AdSense (pub-8245125390626462) | |
| 10.8.4 | No leaked Razorpay/Stripe keys in client bundle | |

---

## 11. SEO + AdSense Readiness

| # | Check | Expected | Status |
|---|---|---|---|
| 11.1 | Every page has unique `<title>` | Verified via View Source | |
| 11.2 | Every page has `<meta name="description">` | Verified | |
| 11.3 | Canonical tag on every page | Matches page URL | |
| 11.4 | Robots.txt valid and reachable | 200 | |
| 11.5 | Sitemap.xml valid and reachable | 200 | |
| 11.6 | Every indexable page ≥ 300 words of prose | Measured | |
| 11.7 | Homepage ≥ 600 words | Measured (was 975) | |
| 11.8 | No matured FMP in sitemap | `grep -Ei '(FMP|Fixed Maturity|[0-9]{3,4}D)'` on sitemap.xml returns 0 | |
| 11.9 | `/premium` has `robots: noindex, nofollow` | Yes | |
| 11.10 | `/auth`, `/dashboard`, `/goals`, `/portfolio`, `/profile`, `/admin` all disallowed in robots.txt | Yes | |
| 11.11 | JSON-LD Organization on homepage | Yes | |
| 11.12 | JSON-LD Article on every blog post | Yes | |
| 11.13 | JSON-LD Person on /author/ojasvi-malik | Yes | |
| 11.14 | OpenGraph tags on every indexable page | Yes | |
| 11.15 | Twitter Card tags on blog posts | Yes | |
| 11.16 | H1 unique per page; one H1 per page | Yes | |
| 11.17 | No 404s reached by clicking internal links | Crawl with a link checker | |
| 11.18 | Every internal `href` is relative or to same origin | Yes | |
| 11.19 | Google Search Console: 0 coverage errors | Yes | |
| 11.20 | ads.txt valid and reachable | 200, contains pub-8245125390626462 | |

---

## 12. Compliance (SEBI / AMFI / privacy)

| # | Check | Expected | Status |
|---|---|---|---|
| 12.1 | ARN-317605 visible on Home, About, Footer, Contact | Yes | |
| 12.2 | "Mutual Fund investments are subject to market risks" disclaimer on every fund page | Yes | |
| 12.3 | Commission disclosure on /disclosures | Yes, trail commission details | |
| 12.4 | SEBI grievance path (distributor → AMC → AMFI → SCORES) on /contact | Yes | |
| 12.5 | No investment-advice language (e.g., "you should buy") on fund pages | Yes | |
| 12.6 | PAN never stored plaintext in DB (encrypted via encryption.ts) | DB inspection | |
| 12.7 | CAS PDF deleted from server after parse | Yes; no persistent store | |
| 12.8 | No PAN/phone logged via console.log | grep codebase | |
| 12.9 | Privacy policy covers GA4, AdSense, CF Relay | Yes | |
| 12.10 | Cookie policy flagged on first visit (if applicable under DPDP Act) | Per privacy counsel | |

---

## 13. Mobile-specific Tests

Run on actual Android (Moto Edge 30) and actual iPhone (15) if available, else Chrome
DevTools device emulation as a fallback.

| # | Case | Expected | Status |
|---|---|---|---|
| 13.1 | Homepage on 360px wide | No horizontal scroll; no clipped text | |
| 13.2 | Fund card grid on mobile | 1-column layout; tap targets ≥ 44×44 | |
| 13.3 | Fund detail return toggle on mobile | Tap responsive, no missed taps | |
| 13.4 | Bottom nav visibility | Always visible on tab screens | |
| 13.5 | Hamburger menu opens/closes smoothly | No layout shift | |
| 13.6 | iOS safe-area insets respected (notch/home indicator) | No content clipped | |
| 13.7 | Forms: input zoom on focus (iOS) | Font size ≥ 16px to prevent auto-zoom | |
| 13.8 | Pull-to-refresh on dashboard | Triggers SWR invalidation | |
| 13.9 | Offline state | Room cache renders old data + offline banner | |
| 13.10 | App launch → Dashboard within 1.5s (cache hit) | Measured | |

---

## 14. Cross-browser Matrix

For each critical page (Home, Blog post, Fund detail), verify on:

| Browser | Home | Blog | Fund | Sign-in | Status |
|---|---|---|---|---|---|
| Chrome 130 desktop | | | | | |
| Chrome Android | | | | | |
| Safari 18 macOS | | | | | |
| Safari iOS 18 | | | | | |
| Firefox 130 | | | | | |
| Edge 130 | | | | | |

Any visual defect, console error, or functional failure on any cell = log a defect.

---

## 15. Internationalisation / locale

| # | Check | Expected | Status |
|---|---|---|---|
| 15.1 | Currency rendered as ₹ (not Rs., INR, or $) | Yes | |
| 15.2 | Lakh/crore formatting (₹1.25 L / ₹1 Cr) | Yes | |
| 15.3 | Dates in DD Mon YYYY or DD/MM/YYYY Indian style | Yes | |
| 15.4 | Numeric separators: Indian grouping (2,00,000 not 200,000) | Yes | |
| 15.5 | `lang="en"` set on `<html>` | Yes | |
| 15.6 | No Unicode artefact strings ("â‚¹" instead of ₹) | Yes | |

---

## 16. Defect Log (fill as you go)

| ID | Severity | Area | Description | Steps to reproduce | Expected | Actual | Status |
|---|---|---|---|---|---|---|---|
| BUG-001 | | | | | | | |
| BUG-002 | | | | | | | |
| BUG-003 | | | | | | | |
| ... | | | | | | | |

**Severity scale**: Critical (prod blocked), High (core flow broken), Medium (non-blocking
bug on common path), Low (cosmetic / rare).

---

## 17. Sign-off

| Section | Total cases | Pass | Fail | Blocked | Sign-off (name + date) |
|---|---|---|---|---|---|
| 1. Unit traces | 28 | | | | |
| 2. API integration | 37 | | | | |
| 3. E2E journeys | 70+ | | | | |
| 4. Smoke | 10 | | | | |
| 5. Sanity | 5 | | | | |
| 6. Regression | 10 | | | | |
| 7. Performance | 30+ | | | | |
| 8. Load / Stress | 5 areas | | | | |
| 9. Accessibility | 15 | | | | |
| 10. Security | 40+ | | | | |
| 11. SEO / AdSense | 20 | | | | |
| 12. Compliance | 10 | | | | |
| 13. Mobile | 10 | | | | |
| 14. Cross-browser | 24 cells | | | | |
| 15. i18n | 6 | | | | |

**Release decision** ( ) Green – ship   ( ) Yellow – ship with caveats   ( ) Red – hold

**Caveats / known issues**: _______________________

**Final tester sign-off**: _______________________

---

## Appendix A — Fastest way to run this plan

1. **Day 1** — Sections 0, 4, 5, 11, 12 (smoke, sanity, SEO, compliance). ~2 hours.
2. **Day 2** — Section 2 (API integration) + §10 (security). ~4 hours.
3. **Day 3** — Section 3 (E2E journeys) across Chrome desktop + Chrome Android. ~6 hours.
4. **Day 4** — Sections 7, 8 (performance + load on localhost). ~4 hours.
5. **Day 5** — Sections 1 (manual unit traces), 9 (a11y), 13–15. ~4 hours.
6. **Day 6** — Cross-browser §14 + final sign-off. ~4 hours.

Total: ~24 hours of focused manual testing for a single tester. A team of 3 can compress
this to 2 days.

## Appendix B — Tools to have installed

- Chrome DevTools (built-in)
- Chrome extension: axe DevTools
- Postman or Insomnia (API testing)
- Apache Bench (`apt-get install apache2-utils` / `brew install httpd`)
- Node.js REPL (for §1 unit traces)
- VoiceOver (macOS built-in) or TalkBack (Android built-in)
- Google Search Console access
- Railway dashboard access
- Vercel dashboard access
