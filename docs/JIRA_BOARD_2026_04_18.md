# Akshaya — Jira Sprint Board
**Generated:** 2026-04-18 | **Source:** UI Audit + P0 Handoff Alignment
**Graph:** `graphify-out/graph.json` — 2,211 nodes, 3,065 edges

---

## EPIC MAP

| Epic | Code | Description | Sprint |
|------|------|-------------|--------|
| Data Pipeline | DATA | Parquet/CSV ingest, backfill, pipeline rerun | S18 |
| **mfdata Mirror** | **MFD** | **Scrape-and-own mfdata.in to our DB (strategic data moat)** | **S18** |
| Trust Fixes | TRUST | Dead buttons, broken progress bar | S18 |
| Design System | DSYS | Light theme, magic hex, typography tokens | S18 |
| Portfolio Intelligence | PINT | XIRR, hero context, benchmark comparison | S19 |
| Fund Discovery | FDIS | Sort/filter, infinite scroll, card data | S19 |
| Fund Detail | FDET | Risk metrics, chart interactivity, empty states | S19 |
| Markets UX | MKTS | Sector layout, market status, FII sparkline | S20 |
| Premium Polish | POLH | Haptics, calculator, goals what-if, profile | S20 |
| AI & Moat | AIMT | Fund overlap, AI analytics, CAS import | S21+ |
| Website & SEO | WSEO | Search Console, sitemap, fund detail pages | S21+ |

---

## SPRINT 18 — NON-NEGOTIABLE (Trust & Data Foundation)
**Goal:** Fix everything that makes the app look broken or dishonest to a first-time user.

---

### [DATA-001] Parquet NAV Ingest → nav_history UPSERT
**Epic:** DATA | **Priority:** P0 CRITICAL | **Type:** Task
**Estimate:** 3 points

**Problem:** `nav_history` has insufficient depth for 3Y/5Y calculations. Risk ratios at 20% fill. `InertExpert2911/Mutual_Fund_Data` parquet = 21.5M NAV rows waiting.

**Acceptance Criteria:**
- [ ] Parquet file downloaded from `InertExpert2911/Mutual_Fund_Data` repo
- [ ] Script written to parse parquet → UPSERT into `nav_history` (scheme_code, date, nav)
- [ ] Duplicate handling: ON CONFLICT (scheme_code, date) DO NOTHING
- [ ] Row count verified: `SELECT COUNT(*) FROM nav_history` before/after
- [ ] No constraint violations — all scheme_codes exist in `funds` table (FK check)

**Graph nodes:** `data_pipeline_handoff_parquetnav_ingest`, `data_pipeline_handoff_nav_history_table`
**Blocks:** DATA-002, DATA-003, DATA-004, FDET-001, AIMT-001

---

### [DATA-002] CSV Metadata Ingest → Fill 6 Zero-Fill Columns
**Epic:** DATA | **Priority:** P0 CRITICAL | **Type:** Task
**Estimate:** 2 points

**Problem:** `amc_code`, `fund_size`, `expense_ratio`, `exit_load`, `min_investment`, `min_sip` all at 0% fill. Same repo's CSV has this data for 14,275+ funds.

**Acceptance Criteria:**
- [ ] CSV parsed — columns mapped to `funds` table fields
- [ ] UPSERT executed: `UPDATE funds SET expense_ratio=..., fund_size=... WHERE scheme_code=...`
- [ ] Fill rate check: `SELECT COUNT(*) FROM funds WHERE expense_ratio IS NOT NULL` — target >80%
- [ ] `min_investment` and `min_sip` populated for all Direct Growth funds
- [ ] No overwrite of existing non-null values (COALESCE pattern)

**Graph nodes:** `data_pipeline_handoff_csv_metadata_ingest`, `data_pipeline_handoff_fillrate_zero_columns`
**Blocks:** FDIS-003 (fund card data), FDET-001 (quick facts)

---

### [DATA-003] Backfill NAV History — 2,553 Direct Growth Funds via mfapi.in
**Epic:** DATA | **Priority:** P0 HIGH | **Type:** Task
**Estimate:** 2 points

**Problem:** mfapi.in backfill script exists (`scripts/backfill-nav-history.py`) but was previously run with `--limit`. Need full run on all 2,553 Direct Growth funds.

**Acceptance Criteria:**
- [ ] `python scripts/backfill-nav-history.py` runs without `--limit`
- [ ] Run after DATA-001 (parquet ingest) to avoid redundant calls
- [ ] Progress logging — script should not silently fail on 404s
- [ ] Rate limiting: max 10 req/s to mfapi.in (avoid ban)
- [ ] Verify: `SELECT scheme_code, COUNT(*) FROM nav_history GROUP BY scheme_code ORDER BY COUNT(*) ASC LIMIT 20` — no scheme with <250 rows (1Y of data)

**Graph nodes:** `data_pipeline_handoff_backfillnav_directgrowth`, `data_pipeline_handoff_backfill_script`, `data_pipeline_handoff_mfapi_in`
**Depends on:** DATA-001

---

### [DATA-004] Pipeline Rerun + Fill Rate Verification
**Epic:** DATA | **Priority:** P0 HIGH | **Type:** Task
**Estimate:** 1 point

**Problem:** After all ingest complete, risk_ratios pipeline must rerun to compute alpha/beta/Sharpe from new NAV data.

**Acceptance Criteria:**
- [ ] `gh workflow run run-pipeline.yml` triggered after DATA-001 + DATA-002 + DATA-003
- [ ] Wait for workflow completion (monitor GitHub Actions)
- [ ] Fill rate audit SQL run:
  - `SELECT COUNT(*) FROM fund_returns WHERE alpha IS NOT NULL` — target >7,000
  - `SELECT COUNT(*) FROM fund_returns WHERE sharpe_ratio IS NOT NULL` — target >7,000
  - `SELECT COUNT(*) FROM fund_returns WHERE returns_3y IS NOT NULL` — target >8,000
- [ ] Document before/after fill rates in `docs/DATA_PIPELINE_STATUS.md`

**Graph nodes:** `data_pipeline_handoff_pipelinererun_postingest`, `data_pipeline_handoff_risk_ratios_pipeline`, `data_pipeline_handoff_run_pipeline_workflow`
**Depends on:** DATA-001, DATA-002, DATA-003

---

### [TRUST-001] Kill Dead Buttons — Import CAS
**Epic:** TRUST | **Priority:** P0 CRITICAL | **Type:** Bug
**Estimate:** 1 point

**Problem:** `_QuickActions` "Import CAS" button in `dashboard_screen.dart` has `onPressed: () {}` — a silent no-op. Users tap and nothing happens. Destroys trust immediately.

**File:** `vmfs_flutter/lib/features/portfolio/dashboard_screen.dart`

**Acceptance Criteria:**
- [ ] Button shows a bottom sheet: "CAS Import — Coming Soon. We're building this feature. Get notified when it launches." + Close button
- [ ] Bottom sheet uses `GlassCard` styling, `VmfsTypography.body`, correct padding
- [ ] No error thrown, no navigation to broken screen
- [ ] Haptic feedback on tap (HapticFeedback.lightImpact)

**Graph nodes:** `ui_audit_problems_deadbutton_importcas`, `ui_audit_problems_dashboard_screen`

---

### [TRUST-002] Kill Dead Buttons — Start SIP + Invest Now
**Epic:** TRUST | **Priority:** P0 CRITICAL | **Type:** Bug
**Estimate:** 1 point

**Problem:** Both "Start SIP" and "Invest Now" in `fund_detail_screen.dart` sticky bottom bar have `onPressed: null`. Primary CTAs in the entire app are non-functional.

**File:** `vmfs_flutter/lib/features/funds/fund_detail_screen.dart`

**Acceptance Criteria:**
- [ ] Bottom sheet shown on tap: "Transact via [AMC Name]. We'll connect you directly." + AMC website link (deep link using `url_launcher`) + "Remind me when in-app SIP launches" option
- [ ] `url_launcher` added to `pubspec.yaml` if not already present
- [ ] Buttons are `enabled` (not null) — `ButtonStyle` reflects active state
- [ ] Haptic feedback on tap

**Graph nodes:** `ui_audit_problems_deadbutton_startsip`, `ui_audit_problems_deadbutton_investnow`, `ui_audit_problems_fund_detail_screen`

---

### [TRUST-003] Fix Dashboard Progress Bar Denominator
**Epic:** TRUST | **Priority:** P0 HIGH | **Type:** Bug
**Estimate:** 1 point

**Problem:** `_SummaryCard` uses `currentValue / (totalInvested * 2)` as progress denominator. A portfolio at 0% gain shows 50% full bar. Meaningless and misleading.

**File:** `vmfs_flutter/lib/features/portfolio/dashboard_screen.dart` ~line 180

**Acceptance Criteria:**
- [ ] Replace `LinearProgressIndicator` with a dual-segment comparison bar:
  - Segment 1 (emerald): `totalInvested`
  - Segment 2 (emerald glow or accent): `currentValue - totalInvested` (gain)
  - Red segment if `currentValue < totalInvested` (loss)
- [ ] Labels: "Invested: ₹X.XX L" | "Current: ₹Y.YY L"
- [ ] No heuristic denominator — bar is bounded by `max(currentValue, totalInvested)`
- [ ] Handles edge case: currentValue = 0 (no holdings yet)

**Graph nodes:** `ui_audit_problems_progressbar_heuristicdenominator`

---

### [DSYS-001] Fix Light Theme — Migrate All Screens to Theme-Aware Colors
**Epic:** DSYS | **Priority:** P0 HIGH | **Type:** Story
**Estimate:** 5 points

**Problem:** `VmfsTheme.light()` is defined but every screen hardcodes `VmfsColors.*` dark tokens. White-on-white rendering in light mode. Profile "Coming Soon" snackbar is a stopgap only.

**Files:** All screens in `vmfs_flutter/lib/features/`

**Acceptance Criteria:**
- [ ] `context.c.*` (or `Theme.of(context).colorScheme.*`) used for ALL colors in all screens
- [ ] Zero direct `VmfsColors.*` references in screen files (grep confirms)
- [ ] Light mode: all text has minimum 4.5:1 contrast ratio
- [ ] Light mode: all glass cards visible (no transparent-on-white)
- [ ] Profile theme toggle re-enabled (remove "Coming Soon" snackbar)
- [ ] `flutter analyze` 0 errors, 0 warnings after migration
- [ ] Tested on device in both dark + light mode

**Graph nodes:** `ui_audit_problems_lighttheme_broken`, `ui_audit_problems_vmfs_theme`
**Sub-tasks:** DSYS-001a (Dashboard), DSYS-001b (Portfolio), DSYS-001c (Discover), DSYS-001d (FundDetail), DSYS-001e (Markets), DSYS-001f (Goals/Profile)

---

### [DSYS-002] Centralize Magic Hex Colors into VmfsColors
**Epic:** DSYS | **Priority:** HIGH | **Type:** Bug
**Estimate:** 1 point

**Problem:** `Color(0xFF001F10)` hardcoded in `discover_screen.dart` pagination active text and `vmfs_button.dart`. Category icon colors are raw hex tuples in `_defaultCategories`. Breaks design token contract.

**Files:**
- `vmfs_flutter/lib/features/funds/discover_screen.dart`
- `vmfs_flutter/lib/shared/vmfs_button.dart`

**Acceptance Criteria:**
- [ ] `VmfsColors.emeraldDeep` (or appropriate semantic name) added for `0xFF001F10`
- [ ] Both files updated to reference token, not literal
- [ ] 8 category colors added as named constants to `VmfsColors` (e.g. `VmfsColors.categoryEquity`)
- [ ] `grep -r "Color(0xFF" lib/` returns zero results (except vmfs_colors.dart itself)

**Graph nodes:** `ui_audit_problems_magichex_colors`, `ui_audit_problems_categorycolors_hardcoded`

---

## MFD EPIC — mfdata.in Scrape-and-Own (STRATEGIC DATA MOAT)

**Context:** mfdata.in is a free, MIT-licensed API covering 14,544 Indian MF schemes with: expense ratio, AUM, Morningstar rating, holdings (6,813 schemes), Sharpe/Sortino/alpha/beta/R²/Jensen/Treynor/information ratio, PE/PB/ROE/ROA, sector allocation, credit quality, fund managers, overlap calculator, stock-holder reverse index, max drawdown, capture ratios. Rate limit: 120 req/min, 10K req/day per IP.

**Strategic decision:** We DO NOT proxy. We SCRAPE to our DB. Reasons: 10K users would blow rate limit instantly; their uptime is 4 days (young service); SEBI compliance needs us to own data lineage; flat scrape cost scales to infinite users.

**Docs:** [`MFDATA_INTEGRATION_PLAN.md`](MFDATA_INTEGRATION_PLAN.md)

---

### [MFD-001] Database Schema Expansion — migrations/013_mfdata_schema.sql
**Epic:** MFD | **Priority:** P0 CRITICAL | **Type:** Task
**Estimate:** 2 points | **Sprint:** 18

**Problem:** We need new tables and columns to hold enriched metadata that doesn't exist in our current schema (family_id concept, fundamentals, credit quality, capture ratios, overlap cache).

**Acceptance Criteria:**
- [ ] Create `migrations/013_mfdata_schema.sql` with all schema changes below
- [ ] New table: `fund_families (family_id PK, family_name, amc_slug, category, has_holdings, has_ratios, created_at, updated_at)`
- [ ] New table: `fund_fundamentals (scheme_code PK FK→funds, pe_ratio, pb_ratio, ps_ratio, dividend_yield, roe, roa, as_of_date, updated_at)`
- [ ] New table: `credit_quality (family_id FK, bucket, fund_pct, category_pct, as_of_date, composite PK)`
- [ ] New table: `fund_overlap_cache (scheme_code_a, scheme_code_b, overlap_percentage, common_stocks, computed_at, composite PK with CHECK a<b)`
- [ ] New table: `category_benchmarks (category, metric, period, value, as_of_date, composite PK)`
- [ ] New table: `fund_managers (id SERIAL PK, family_id FK, manager_name, since_date, role, bio)`
- [ ] ALTER `funds` ADD: `min_lumpsum`, `morningstar_rating`, `risk_label`, `benchmark_name`, `day_change_pct`, `mfdata_family_id`
- [ ] ALTER `fund_returns` ADD: `r_squared`, `jensens_alpha`, `treynor_ratio`, `information_ratio`, `capture_up`, `capture_down`, `max_drawdown`, `max_drawdown_date`
- [ ] ALTER `fund_top_holdings` ADD: `source VARCHAR(20) DEFAULT 'pdf'`
- [ ] Index: `idx_holdings_stock_name` on `fund_top_holdings(holding_name) WHERE source='mfdata'` (for stock-holder reverse lookup)
- [ ] Index: `idx_funds_mfdata_family` on `funds(mfdata_family_id)`
- [ ] Run via `gh workflow run run-migrations.yml -f migrations="013"`
- [ ] Verify: `\d fund_families` and `\d fund_fundamentals` show expected columns

**Blocks:** All other MFD stories.

---

### [MFD-002] Build scripts/mfdata-mirror.py — Core Scraper Infrastructure
**Epic:** MFD | **Priority:** P0 CRITICAL | **Type:** Task
**Estimate:** 3 points | **Sprint:** 18

**Problem:** Need a generic scraper that respects rate limits, checkpoints on failure, logs everything, and supports multiple modes.

**Acceptance Criteria:**
- [ ] File: `scripts/mfdata-mirror.py` with argparse
- [ ] Modes supported: `--mode initial-full`, `daily-metadata`, `weekly-ratios`, `monthly-holdings`, `scheme` (single scheme)
- [ ] Rate limiter: max 100 req/min sleep-based (safety margin below 120/min)
- [ ] Auto-abort if `x-ratelimit-daily-remaining < 500`
- [ ] Checkpoint file `/tmp/mfdata_mirror_checkpoint_<mode>.json` with: completed_families/schemes, last_run, api_calls_used
- [ ] Structured logging: rate-limit headers on every request, retry on 429/5xx with exponential backoff
- [ ] Every write is idempotent UPSERT (ON CONFLICT DO UPDATE) — re-runs never corrupt
- [ ] Every row tagged `source='mfdata'` and `fetched_at=NOW()`
- [ ] Dry-run mode `--dry-run` — no DB writes
- [ ] `--sample N` — process first N items only
- [ ] Exit code 0 on success, 1 on rate-limit hit, 2 on unrecoverable error

**Technical Design:**
```python
class MfDataClient:
    def __init__(self, base_url='https://mfdata.in', rate_limit_per_min=100)
    def get(self, path, params=None) -> dict  # cached, rate-limited
    def get_scheme(self, scheme_code) -> dict
    def get_family_holdings(self, family_id, month=None) -> dict
    def get_overlap(self, scheme_codes: list[str]) -> dict
```

**Graph integration:** After completion, add to graphify via `/graphify --update`.

**Depends on:** MFD-001

---

### [MFD-003] Initial Full Mirror — One-Time Bulk Scrape
**Epic:** MFD | **Priority:** P0 HIGH | **Type:** Task
**Estimate:** 1 point (but 36+ hours wall clock, runs unattended) | **Sprint:** 18

**Problem:** Need to populate our DB with every piece of data mfdata.in has for 14,544 schemes / 2,906 families.

**Acceptance Criteria:**
- [ ] Run: `nohup python3 scripts/mfdata-mirror.py --mode initial-full > logs/mfdata-initial.log 2>&1 &`
- [ ] Scrapes in order (each with its own rate budget):
  1. `/stats` — snapshot baseline (1 call)
  2. `/api/v1/amcs` — all 51 AMCs (~2 calls)
  3. `/api/v1/families` — all 7,839 families (~16 paginated calls)
  4. `/api/v1/schemes/batch/lookup` — 14,544 schemes in 100-code batches (~150 calls)
  5. `/api/v1/schemes/{code}` — all 14,544 individual scheme details (full enrichment)
  6. `/api/v1/schemes/{code}/returns` — returns for all (14,544 calls)
  7. `/api/v1/families/{id}/holdings` — all 2,906 families with holdings
  8. `/api/v1/families/{id}/sectors` — sector allocation (2,906 calls)
  9. `/api/v1/families/{id}/ratios` — ratios (2,906 calls)
  10. `/api/v1/families/{id}/risk-detail` — risk metrics (2,906 calls)
  11. `/api/v1/families/{id}/allocation` — asset allocation (2,906 calls)
  12. `/api/v1/families/{id}/credit-quality` — debt funds (~1,500 relevant)
  13. `/api/v1/families/{id}/people` — fund managers (2,906 calls)
  14. `/api/v1/families/{id}/performance` — annual returns (2,906 calls)
- [ ] Total expected: ~50,000 API calls across 5-6 days at 10K/day quota
- [ ] OR: split into 3 parallel IPs (GitHub Actions + Railway + Vercel) — complete in 1.5 days
- [ ] Post-scrape verification: fill rate report for every enriched column

**Expected fill rates after completion:**
- `expense_ratio`: 0% → 95%
- `morningstar_rating`: 0% → 80%
- Sharpe / Sortino / alpha / beta: 20% (from parquet) → 90%
- Holdings-covered schemes: 1,200 → 6,800
- Fund fundamentals (PE, ROE, etc.): 0% → 75%

**Depends on:** MFD-001, MFD-002

---

### [MFD-004] Daily Metadata Sync Cron — Active Direct Growth Focus
**Epic:** MFD | **Priority:** HIGH | **Type:** Task
**Estimate:** 1 point | **Sprint:** 18

**Problem:** NAV + AUM + expense ratio + Morningstar rating shift daily. Need a nightly refresh for the UI-relevant subset.

**Acceptance Criteria:**
- [ ] Create `.github/workflows/mfdata-daily.yml`
- [ ] Cron: `30 18 * * *` (00:00 IST daily, after AMFI daily-update at 21:30 UTC prev day)
- [ ] Runs: `python3 scripts/mfdata-mirror.py --mode daily-metadata`
- [ ] Targets: active Direct Growth schemes only (~2,400 calls)
- [ ] Updates: `funds.latest_nav`, `funds.fund_size`, `funds.expense_ratio`, `funds.morningstar_rating`, `funds.day_change_pct`
- [ ] Budget: ~2,400 calls = 24% of daily quota — safe margin
- [ ] Alert on failure: Slack/email via GitHub Action notification
- [ ] Secrets: `RAILWAY_DATABASE_URL`, no API key needed for mfdata.in

**Depends on:** MFD-003

---

### [MFD-005] Weekly Ratios + Returns Sync Cron
**Epic:** MFD | **Priority:** HIGH | **Type:** Task
**Estimate:** 1 point | **Sprint:** 18

**Problem:** Ratios (Sharpe/alpha/beta) and returns (1M-5Y) are trailing calculations that update weekly. Doesn't need daily refresh.

**Acceptance Criteria:**
- [ ] Create `.github/workflows/mfdata-weekly.yml`
- [ ] Cron: Mon `0 20 * * 1` (01:30 IST Tuesday, half-1 of universe); Thu `0 20 * * 4` (01:30 IST Friday, half-2)
- [ ] Split load to stay under daily quota
- [ ] Half-1: schemes 0-7,500 | Half-2: schemes 7,500-14,544
- [ ] Updates: `fund_returns` table (all return columns + ratios), `fund_fundamentals` (PE/PB/ROE)
- [ ] Refresh `mv_top_funds` materialized view after both halves complete (Thu night)

**Depends on:** MFD-003

---

### [MFD-006] Monthly Holdings Sync Cron — SEBI Disclosure Window
**Epic:** MFD | **Priority:** HIGH | **Type:** Task
**Estimate:** 1 point | **Sprint:** 18

**Problem:** AMCs disclose portfolio holdings monthly per SEBI regulation. mfdata.in scrapes them; we mirror monthly (not more often — waste of calls).

**Acceptance Criteria:**
- [ ] Create `.github/workflows/mfdata-monthly.yml`
- [ ] Cron: `0 18 6 * *` (6th of month 23:30 IST — 5 days after month-end disclosure deadline)
- [ ] Updates: `fund_top_holdings`, `scheme_sector_summary`, `credit_quality`, `fund_managers`, family `allocation`
- [ ] Full 2,906 families refresh in one run
- [ ] Budget: ~14K calls spread across 6 hours (stays under 120/min)
- [ ] Post-run: rebuild `stocks/{name}/holders` reverse-index (for MFD-015)
- [ ] Conflict handling: if PDF engine also wrote holdings, prefer mfdata (richer), keep PDF as fallback via `source` column

**Depends on:** MFD-003

---

### [MFD-007] Overlap Precompute Worker — Active Direct Growth Pairs
**Epic:** MFD | **Priority:** MEDIUM | **Type:** Task
**Estimate:** 2 points | **Sprint:** 19

**Problem:** Calling `/api/v1/overlap` on-demand per user request is slow and hits rate limits. Precompute overlap for every pair of active Direct Growth funds once, serve from cache instantly.

**Acceptance Criteria:**
- [ ] Script: `scripts/mfdata-overlap-precompute.py`
- [ ] Fetches holdings for all active Direct Growth families (from our `fund_top_holdings`)
- [ ] Computes pairwise overlap locally (no API calls needed — we have the data)
- [ ] Pairs: C(2400, 2) ≈ 2.88M pairs (cap at top 500 most-held schemes = 125K pairs)
- [ ] Upserts to `fund_overlap_cache`
- [ ] Runs weekly (after MFD-006 monthly holdings refresh)
- [ ] Query pattern: `SELECT overlap_percentage FROM fund_overlap_cache WHERE scheme_code_a=? AND scheme_code_b=?` — sub-10ms response
- [ ] Cache invalidation: recompute after every monthly holdings sync

**Depends on:** MFD-006

---

### [MFD-008] Stock Holders Reverse Index — "Which Funds Own TCS?"
**Epic:** MFD | **Priority:** MEDIUM | **Type:** Task
**Estimate:** 2 points | **Sprint:** 19

**Problem:** mfdata.in `/stocks/{name}/holders` returns "all mutual funds that hold this stock." Unique feature. We precompute from our `fund_top_holdings` table.

**Acceptance Criteria:**
- [ ] Partial index: `idx_holdings_stock_name ON fund_top_holdings (holding_name) WHERE source='mfdata'`
- [ ] Backend endpoint: `GET /api/stocks/:stockName/holders` → queries our DB
- [ ] Returns: list of funds with weights, sorted by weight desc
- [ ] Cache TTL: 24h (holdings are monthly, 24h is conservative)
- [ ] Used by: Flutter stock exposure screen (future AIMT story)

**Depends on:** MFD-006

---

### [MFD-009] Category Benchmarks Extraction
**Epic:** MFD | **Priority:** MEDIUM | **Type:** Task
**Estimate:** 1 point | **Sprint:** 19

**Problem:** mfdata.in returns "category_averages" (avg Sharpe, beta, PE for SEBI category) inside every `/schemes/{code}` response. We should extract and cache these as first-class data — they power outperformance indicators in Fund Cards.

**Acceptance Criteria:**
- [ ] Modify `mfdata-mirror.py` scheme-detail handler: extract `category_averages` from every response
- [ ] Upsert to `category_benchmarks` table (category + metric + period unique)
- [ ] Aggregated properly across schemes in same category (pick most-recent `as_of_date`)
- [ ] Used by: FDET-004 (returns table outperformance), FDIS-003 (fund card "Beat Category" badge)

**Depends on:** MFD-005

---

### [MFD-010] Health Monitoring + Stale Data UI Banner
**Epic:** MFD | **Priority:** MEDIUM | **Type:** Story
**Estimate:** 2 points | **Sprint:** 19

**Problem:** If mfdata.in goes down or our sync breaks, users should see data but know it's stale. No silent failures.

**Acceptance Criteria:**
- [ ] Track `funds.mfdata_last_synced_at` (add to schema)
- [ ] Daily health check: poll `mfdata.in/api/v1/uptime` and `/stats`, log to our DB
- [ ] If 3 consecutive failures: alert (Slack/email) + skip that cycle's sync
- [ ] Flutter: if `fund_returns.updated_at > 7 days ago`, show "Updated N days ago" pill on Fund Detail
- [ ] Flutter: Pro subscribers see exact timestamp; free users see "< 7 days" / "> 7 days"
- [ ] Backend endpoint: `GET /api/health/data-freshness` returns staleness summary

**Depends on:** MFD-004

---

### [MFD-011] Attribution + Goodwill Outreach
**Epic:** MFD | **Priority:** LOW | **Type:** Task
**Estimate:** 1 point | **Sprint:** 19

**Problem:** mfdata.in is MIT-licensed (mirroring allowed), but courtesy and legal hygiene require attribution + outreach.

**Acceptance Criteria:**
- [ ] "About" page on `vmfinancialservices.com`: add "Some data sourced from mfdata.in (MIT License)"
- [ ] Flutter Profile → About screen: same attribution line
- [ ] Send email to mfdata.in maintainer (check GitHub for contact): brief intro, "we love what you're building, we're mirroring to reduce load on your side, happy to sponsor hosting if useful"
- [ ] Document in `docs/DATA_PROVENANCE.md`: list of every data source, license, attribution text
- [ ] Track licensing obligations (none strict beyond MIT attribution)

---

### [MFD-012] Backend API Enrichment — Serve Enriched Fund Details
**Epic:** MFD | **Priority:** HIGH | **Type:** Story
**Estimate:** 2 points | **Sprint:** 19

**Problem:** Existing `/api/funds/:code` endpoint returns a slim payload. Flutter needs the enriched data to populate FundDetail screen.

**Acceptance Criteria:**
- [ ] `/api/funds/:code` response adds: `expense_ratio`, `exit_load`, `min_sip`, `min_lumpsum`, `morningstar_rating`, `risk_label`, `benchmark_name`, `aum`, full ratios (Sharpe/Sortino/alpha/beta/r_squared/treynor/jensens_alpha/information_ratio), fundamentals (PE/PB/PS/ROE/ROA/dividend_yield)
- [ ] `/api/funds/:code/holdings` new endpoint → returns top holdings from our DB (reads `fund_top_holdings`)
- [ ] `/api/funds/:code/sectors` → sector allocation
- [ ] `/api/funds/:code/credit-quality` → debt fund credit buckets
- [ ] `/api/funds/:code/managers` → fund manager list
- [ ] `/api/funds/:code/overlap?vs=<other_code>` → precomputed overlap (reads `fund_overlap_cache`)
- [ ] All endpoints cached server-side 5 min (Vercel edge or Railway in-memory)
- [ ] Response includes `data_freshness: { source: 'mfdata', fetched_at: '...' }` metadata

**Depends on:** MFD-003 (data must exist), MFD-007 (overlap cache)

---

### [MFD-013] Migrate Fund Detail Flutter Screen to Consume Enriched Data
**Epic:** MFD | **Priority:** HIGH | **Type:** Story
**Estimate:** 3 points | **Sprint:** 19

**Problem:** Flutter FundDetailScreen currently displays partial data because backend didn't serve it. With MFD-012 live, the screen can render every section fully.

**Acceptance Criteria:**
- [ ] `FundService.getFundDetail(schemeCode)` model updated to include all new fields
- [ ] FundDetailScreen Quick Facts section: expense ratio + exit load + min SIP + AUM all populated
- [ ] Risk Metrics section (new): Sharpe, Sortino, alpha, beta, std dev, R² — from `fund_returns`
- [ ] Fund Fundamentals section (new): PE, PB, ROE, dividend yield
- [ ] Holdings section: uses enriched data (6,800 schemes covered vs 1,200 before)
- [ ] Credit Quality section (debt funds only): stacked bar AAA→D
- [ ] Fund Managers section: name + tenure
- [ ] Morningstar rating: display as 1-5 gold stars in hero area
- [ ] Risk label badge: "Very High Risk" / "High Risk" / etc. color-coded
- [ ] Benchmark name displayed prominently
- [ ] Data freshness footer: "Updated: N days ago"

**Depends on:** MFD-012
**Closes:** FDET-001, FDET-002 (partially), FDET-004

---

### [MFD-014] Flutter Fund Card — Show Enriched Metadata
**Epic:** MFD | **Priority:** HIGH | **Type:** Story
**Estimate:** 2 points | **Sprint:** 19

**Problem:** DiscoverScreen fund cards show only name + 1Y return. With enriched data, cards can show category + risk label + AUM + expense ratio.

**Acceptance Criteria:**
- [ ] Card layout updated: Fund name | AMC | Category badge | Risk label | AUM | Expense ratio | 1Y return
- [ ] Category badge color-coded (Equity = emerald, Debt = blue, Hybrid = amber, etc.)
- [ ] Risk label color-coded (Low = blue, Moderate = green, High = amber, Very High = red)
- [ ] AUM formatted: ₹XX Cr / ₹XX,XXX Cr
- [ ] Expense ratio: "0.85% p.a."
- [ ] Card max height: 100px (slightly taller than before but still compact)
- [ ] 1Y return color-coded (green if > category avg, red if below)

**Depends on:** MFD-012, MFD-009 (category benchmarks)
**Closes:** FDIS-003

---

### [MFD-015] Portfolio Overlap Flutter Screen — Using Precomputed Cache
**Epic:** MFD | **Priority:** HIGH | **Type:** Story
**Estimate:** 5 points | **Sprint:** 19-20

**Problem:** The killer moat feature. Precomputed overlap cache (MFD-007) makes this instant.

**Acceptance Criteria:**
- [ ] Flutter: new screen `PortfolioOverlapScreen` reachable from Portfolio screen
- [ ] User has 3+ holdings → screen auto-loads
- [ ] Displays overlap matrix (heatmap): rows/cols = user's funds, cell color = overlap %
- [ ] Tap cell → drill-down: shows common stocks with weights
- [ ] Top section: "Highest overlap pair: Fund A + Fund B (87%)" — flagged as "redundant"
- [ ] Diversification quality score: 1-100 based on avg pairwise overlap
- [ ] "Effective fund count" metric: if you have 9 funds but avg overlap 60%, effective = ~4 funds
- [ ] Stock concentration view: "You own Reliance via 7 funds (18% effective exposure)"
- [ ] Backend query: pure DB reads from `fund_overlap_cache` — no external calls
- [ ] Performance: page loads in < 500ms even for 10-fund portfolios

**Depends on:** MFD-007 (overlap cache), CAS import (AIMT-001)
**Closes:** AIMT-002 (Fund Overlap Analysis) — this is the replacement for that 8-point story
**Note:** Can ship without CAS import using manual scheme selection first

---

### [MFD-016] Stock Exposure Flutter Screen — Reverse Lookup
**Epic:** MFD | **Priority:** MEDIUM | **Type:** Story
**Estimate:** 3 points | **Sprint:** 20

**Problem:** After portfolio import, users should see "total effective exposure to Reliance" across all their funds — unique feature.

**Acceptance Criteria:**
- [ ] Flutter: `StockExposureScreen` reachable from PortfolioOverlap
- [ ] For each unique stock in user's aggregate holdings: show which of user's funds hold it, with weight
- [ ] "Total exposure to Reliance: 4.2% of portfolio (via 3 funds)"
- [ ] Sortable by exposure %, alphabetical, sector
- [ ] Top N concentration risks highlighted ("You have >3% exposure to 5 stocks — concentration risk")
- [ ] Tap a stock → see all funds holding it (uses MFD-008 reverse index)

**Depends on:** MFD-008 (reverse index), MFD-015

---

### [MFD-017] Top Performers Backend — Live Leaderboard from Our DB
**Epic:** MFD | **Priority:** MEDIUM | **Type:** Story
**Estimate:** 2 points | **Sprint:** 20

**Problem:** HomeScreen "Top Performing Funds" currently uses stale `mv_top_funds` that was built on sparse data. After MFD mirror, we have rich ratios for 6,800 funds — rebuild materialized view using full metrics.

**Acceptance Criteria:**
- [ ] Rewrite `mv_top_funds` SQL to use enriched `fund_returns` + `funds.morningstar_rating`
- [ ] Quality score formula: 0.4 × normalized_return_3y + 0.3 × normalized_sharpe + 0.2 × morningstar + 0.1 × low_expense
- [ ] Refresh materialized view in weekly cron (after MFD-005)
- [ ] Backend `/api/funds/top-performers?period=1y&category=Flexi+Cap&limit=10` returns from refreshed MV
- [ ] Flutter HomeScreen: add category filter chips + period selector

**Depends on:** MFD-003, MFD-005

---

### [MFD-018] Scheme Comparison Flutter Screen
**Epic:** MFD | **Priority:** LOW | **Type:** Story
**Estimate:** 3 points | **Sprint:** 20

**Problem:** Users comparing funds today must open 2 tabs. Side-by-side comparison is a killer feature.

**Acceptance Criteria:**
- [ ] Flutter: `CompareScreen` reachable from DiscoverScreen + FundDetail
- [ ] User adds 2-5 funds to comparison basket
- [ ] Backend endpoint: `GET /api/funds/compare?codes=122640,118989,...` → reads from our DB
- [ ] Side-by-side table: 1M/3M/6M/1Y/3Y/5Y returns, Sharpe, alpha, beta, expense ratio, AUM, Morningstar
- [ ] Visual winners: best-in-row cell highlighted in emerald
- [ ] Overlap row: pairwise overlap % between every pair
- [ ] Share as PDF (future)

**Depends on:** MFD-012, MFD-007

---

### [MFD-019] Data Freshness Admin Dashboard
**Epic:** MFD | **Priority:** LOW | **Type:** Task
**Estimate:** 2 points | **Sprint:** 20

**Problem:** As maintainers, we need visibility into sync health without reading DB directly.

**Acceptance Criteria:**
- [ ] Admin page at `/admin/data-freshness` (behind admin auth)
- [ ] Shows: last successful sync per mode (daily/weekly/monthly)
- [ ] Per-column fill rate: `SELECT COUNT(*) WHERE ... IS NOT NULL / COUNT(*)` for every enriched column
- [ ] Graph: daily API call count vs 10K quota (chart)
- [ ] Stale data alerts: schemes where `mfdata_last_synced_at > 14 days` flagged
- [ ] Trigger manual sync button (calls mfdata-mirror.py on Railway)

**Depends on:** MFD-004, MFD-005, MFD-006

---

### [MFD-020] Disaster Recovery — mfdata.in Goes Down Playbook
**Epic:** MFD | **Priority:** LOW | **Type:** Task
**Estimate:** 1 point | **Sprint:** 20

**Problem:** mfdata.in is a young service (4-day uptime). Must have a plan.

**Acceptance Criteria:**
- [ ] Document `docs/MFDATA_DR_PLAYBOOK.md`:
  1. What breaks if mfdata goes down
  2. How long we can serve stale data (answer: indefinitely — we own the data)
  3. Fallback data sources for each endpoint (PDF engine for holdings, our parquet for NAV, manual computation for ratios)
  4. Contact info for mfdata maintainers
- [ ] Weekly backup of `fund_families`, `fund_fundamentals`, `fund_overlap_cache`, `credit_quality` to S3
- [ ] Decision tree: when to switch to fallback mode (3 consecutive failed daily syncs? 7? configurable threshold)

---

## MFD EPIC — Sprint Allocation Summary

| Sprint | Story | Points | Status |
|--------|-------|--------|--------|
| **S18** | MFD-001 Schema expansion | 2 | **P0** |
| S18 | MFD-002 Scraper script | 3 | P0 |
| S18 | MFD-003 Initial full mirror | 1 (36h wall) | P0 |
| S18 | MFD-004 Daily sync cron | 1 | HIGH |
| S18 | MFD-005 Weekly sync cron | 1 | HIGH |
| S18 | MFD-006 Monthly holdings cron | 1 | HIGH |
| **S18 Total** | | **9 pts** | |
| S19 | MFD-007 Overlap precompute | 2 | MEDIUM |
| S19 | MFD-008 Stock reverse index | 2 | MEDIUM |
| S19 | MFD-009 Category benchmarks | 1 | MEDIUM |
| S19 | MFD-010 Health monitoring | 2 | MEDIUM |
| S19 | MFD-011 Attribution + outreach | 1 | LOW |
| S19 | MFD-012 Backend API enrich | 2 | HIGH |
| S19 | MFD-013 Flutter Fund Detail | 3 | HIGH |
| S19 | MFD-014 Flutter Fund Card | 2 | HIGH |
| S19 | MFD-015 Overlap screen (partial) | 3 | HIGH |
| **S19 Total** | | **18 pts** | |
| S20 | MFD-015 Overlap screen (completion) | 2 | HIGH |
| S20 | MFD-016 Stock exposure screen | 3 | MEDIUM |
| S20 | MFD-017 Top performers rewrite | 2 | MEDIUM |
| S20 | MFD-018 Compare screen | 3 | LOW |
| S20 | MFD-019 Admin dashboard | 2 | LOW |
| S20 | MFD-020 DR playbook | 1 | LOW |
| **S20 Total** | | **13 pts** | |

**MFD Epic Grand Total: 40 points** (across 3 sprints)

---

## UPDATED DEPENDENCY MAP (Critical Path)

```
MFD-001 Schema ─┬─→ MFD-002 Scraper ─→ MFD-003 Initial Full Mirror
                │                              ↓
                │                      ┌───────┼───────┬────────┐
                │                      ↓       ↓       ↓        ↓
                │                   MFD-004 MFD-005 MFD-006  MFD-009
                │                   (daily) (weekly)(monthly)(categ)
                │                                      ↓
                │                                   MFD-007 (overlap cache)
                │                                   MFD-008 (stock reverse)
                │                                      ↓
                │                                   MFD-012 (backend API)
                │                                      ↓
                │                             ┌────────┼────────┬──────────┐
                │                             ↓        ↓        ↓          ↓
                │                        MFD-013  MFD-014  MFD-015    MFD-017
                │                        (FDet)   (Card)  (Overlap)  (Top)
                │                                            ↓
                │                                        MFD-016 (Stock exposure)
                │
DATA-001 Parquet ────────┐                 MFD-018 Compare, MFD-019 Admin, MFD-020 DR
                         ↓
                      DATA-004 Pipeline rerun (enriches what MFD-003 hasn't covered)

TRUST-001/002/003 ← INDEPENDENT (ship immediately, no dependencies)
DSYS-001/002     ← INDEPENDENT (ship immediately)
```

---

## RE-PRIORITIZED SPRINT 18 (Revised Based on MFD Discovery)

| Order | Story | Points | Type | Notes |
|-------|-------|--------|------|-------|
| 1 | **MFD-001** Schema expansion | 2 | Migration | Unblocks everything MFD |
| 2 | MFD-002 Scraper infra | 3 | Code | Runs in parallel with trust fixes |
| 3 | TRUST-001/002/003 | 3 | Bug | Can ship during scraper development |
| 4 | DSYS-002 Magic hex | 1 | Refactor | Quick win |
| 5 | **MFD-003** Initial full mirror | 1 (but 36h bg) | Execution | Run overnight / weekend |
| 6 | DATA-004 Pipeline rerun | 1 | Execution | Fills gaps mfdata doesn't cover |
| 7 | DSYS-001 Light theme | 5 | Refactor | Can ship in parallel |
| 8 | MFD-004/005/006 Crons | 3 | Wiring | Quick Ansible-style work |
| **TOTAL SPRINT 18** | | **19 pts** | | |

**Verdict:** Sprint 18 grows from 17 → 19 points but unlocks 13 Sprint 19/20 stories simultaneously.

---

## SPRINT 19 — DIFFERENTIATION (Analytics + Discovery)
**Goal:** Add the data/analytics features that Groww/INDmoney don't have. Requires Sprint 18 data pipeline complete.

---

### [PINT-001] Add Portfolio XIRR to Dashboard + Portfolio Screens
**Epic:** PINT | **Priority:** HIGH | **Type:** Story
**Estimate:** 3 points

**Problem:** XIRR (annualized return) is the single most meaningful number in a MF portfolio. Absent from both screens. All competitors show it.

**Acceptance Criteria:**
- [ ] Backend: `GET /api/portfolio/summary` returns `xirr` field (or compute client-side from holdings)
- [ ] Dashboard `_SummaryCard`: show XIRR below hero number — `"+12.3% XIRR"` in emerald or red
- [ ] Portfolio screen header: XIRR prominent alongside total current value
- [ ] Handle edge case: XIRR undefined for <1 year portfolios → show "< 1Y" label
- [ ] XIRR computation verified against known test case

**Graph nodes:** `ui_audit_problems_missing_xirr_display`
**Depends on:** DATA-004 (accurate NAV data for computation)

---

### [PINT-002] Dashboard Hero Context — Absolute + % Change
**Epic:** PINT | **Priority:** HIGH | **Type:** Story
**Estimate:** 2 points

**Problem:** Hero INR number displayed with zero context. No indication if portfolio is up or down, by how much, over what period.

**Acceptance Criteria:**
- [ ] Below hero number: `"+₹12,450 (+8.3%) all time"` — color coded emerald/red
- [ ] Second line optional: `"Today: +₹340 (+0.2%)"` if daily NAV delta available
- [ ] Uses `VmfsTypography.monoSm` for the change numbers
- [ ] Handles negative (red color token), zero (neutral grey), positive (emerald)
- [ ] Animations: number change triggers subtle count-up on load

**Graph nodes:** `ui_audit_problems_missing_hero_context`

---

### [PINT-003] Portfolio Pie Chart — Add Persistent Legend
**Epic:** PINT | **Priority:** HIGH | **Type:** Story
**Estimate:** 2 points

**Problem:** 7 slices (6 holdings + Other) with no labels. User must tap each slice individually to identify holdings.

**Acceptance Criteria:**
- [ ] Legend list rendered below donut chart
- [ ] Each legend row: color dot + fund name (truncated at 20 chars) + % of portfolio
- [ ] Active slice (tapped) is highlighted in both chart AND legend row
- [ ] "Show All" if >6 holdings (expand to show full list)
- [ ] Legend uses `VmfsTypography.caption`

**Graph nodes:** `ui_audit_problems_donutchart_nolegend`

---

### [PINT-004] Portfolio vs Nifty 50 Benchmark Line
**Epic:** PINT | **Priority:** HIGH | **Type:** Story
**Estimate:** 3 points

**Problem:** Portfolio screen shows returns in isolation. No benchmark comparison. Users have no frame of reference for whether performance is good.

**Acceptance Criteria:**
- [ ] Portfolio screen shows: portfolio CAGR vs Nifty 50 CAGR for same period
- [ ] Visual: simple two-row comparison — "Your Portfolio: +14.2%" vs "Nifty 50: +11.8% (+2.4%)"
- [ ] Color coded: green if beating benchmark, red if underperforming
- [ ] Benchmark data from `benchmark_data` table (already exists in DB)
- [ ] Period selector: 1Y / 3Y / All Time

**Graph nodes:** `ui_audit_problems_missing_benchmarkcomparison`
**Depends on:** DATA-004

---

### [FDET-001] Fund Detail — Risk Metrics Section
**Epic:** FDET | **Priority:** HIGH | **Type:** Story
**Estimate:** 3 points

**Problem:** Sharpe, Sortino, beta, alpha, standard deviation absent from fund detail despite data existing in `fund_returns` table. Core differentiator vs Groww.

**Acceptance Criteria:**
- [ ] New "Risk Metrics" section in fund_detail_screen.dart after Returns Table
- [ ] Displays: Alpha, Beta, Sharpe Ratio, Sortino Ratio, Standard Deviation
- [ ] Each metric has a one-line tooltip/explanation (e.g. "Alpha: excess return vs benchmark")
- [ ] Shows "Data updating" placeholder when value is null (not blank)
- [ ] Numbers formatted to 2 decimal places, `VmfsTypography.mono`
- [ ] Tapping any metric shows bottom sheet with explanation + benchmark comparison

**Graph nodes:** `ui_audit_problems_funddetail_noriskmetrics`, `ui_audit_problems_fund_returns_db`
**Depends on:** DATA-004

---

### [FDET-002] Fund Detail — Fix Empty Data States
**Epic:** FDET | **Priority:** HIGH | **Type:** Bug
**Estimate:** 1 point

**Problem:** Holdings, sectors, fund managers sections silently render blank when API returns empty. User assumes app is broken.

**Acceptance Criteria:**
- [ ] Each empty section shows: `VmfsErrorCard` variant with message "Data syncing — check back after 10 PM tonight"
- [ ] Message references the daily NAV sync cron time (21:30 IST)
- [ ] Skeleton state: shimmer placeholders during loading (already exists in other screens — reuse `VmfsSkeleton`)
- [ ] Affects: Holdings, Sectors, Fund Managers subsections

**Graph nodes:** `ui_audit_problems_funddetail_emptydatasilent`

---

### [FDET-003] NAV Chart — Touch-to-Scrub Interaction
**Epic:** FDET | **Priority:** MEDIUM | **Type:** Story
**Estimate:** 3 points

**Problem:** NAV line chart is visual only. No interactivity. Groww and Apple Stocks both support finger-drag to see NAV at any point.

**Acceptance Criteria:**
- [ ] `fl_chart` `LineTouchData` configured with custom `touchTooltipData`
- [ ] Tooltip shows: exact NAV value + date on touch
- [ ] Drag supported: finger slides across chart, tooltip follows
- [ ] Touch releases: chart returns to no-selection state gracefully
- [ ] Uses `VmfsTypography.monoSm` for tooltip numbers

**Graph nodes:** `ui_audit_problems_navchart_notinteractive`

---

### [FDET-004] Returns Table — Add Outperformance Indicators
**Epic:** FDET | **Priority:** MEDIUM | **Type:** Story
**Estimate:** 2 points

**Problem:** Returns table is flat numbers with no context. No indication whether 14.3% is good or bad vs category or benchmark.

**Acceptance Criteria:**
- [ ] Each return row: fund return + category avg + benchmark
- [ ] Outperformance delta shown: `+2.3%` (green) or `-1.1%` (red) vs benchmark
- [ ] Percentile badge: "Top 15% in category" (if data available from `fund_returns.percentile`)
- [ ] Rolling returns consistency: small sparkline (7 bars) showing year-by-year consistency

**Graph nodes:** `ui_audit_problems_returns_flattable`
**Depends on:** DATA-004

---

### [FDIS-001] Discover Screen — Sort + Filter Controls
**Epic:** FDIS | **Priority:** HIGH | **Type:** Story
**Estimate:** 4 points

**Problem:** Fund search returns results in DB order. Zero sort/filter. INDmoney has 8 filter dimensions. Groww has sort. Without this, Discover is a lookup not a discovery tool.

**Acceptance Criteria:**
- [ ] Sort chip bar: "1Y Returns", "3Y Returns", "AUM", "Expense Ratio" — horizontally scrollable
- [ ] Active sort highlighted with emerald accent
- [ ] Filter bottom sheet: Category (8 options), Risk Level (Low/Moderate/High), AMC (dropdown)
- [ ] Filters applied server-side via API query params (not client-side filtering of loaded results)
- [ ] Filter count badge on filter button when filters active
- [ ] Clear all filters option

**Graph nodes:** `ui_audit_problems_search_nosortfilter`
**Depends on:** DATA-002 (expense_ratio, fund_size needed for sort)

---

### [FDIS-002] Discover Screen — Replace Pagination with Infinite Scroll
**Epic:** FDIS | **Priority:** HIGH | **Type:** Story
**Estimate:** 2 points

**Problem:** `_Pagination` widget uses numbered page buttons — desktop web pattern on mobile. Every major mobile app uses infinite scroll.

**Acceptance Criteria:**
- [ ] Remove `_Pagination` widget entirely
- [ ] Implement `SliverList` with load-more trigger at 80% scroll depth
- [ ] `_searchResultsProvider` uses page/offset params, auto-fetches next page on trigger
- [ ] Loading indicator at bottom during fetch (not full-screen spinner)
- [ ] Scroll position preserved on back navigation (Riverpod state maintained)
- [ ] Empty `_Pagination` class can be deleted — no other usages

**Graph nodes:** `ui_audit_problems_search_paginationwrongpattern`

---

### [FDIS-003] Fund Cards — Add AUM + Risk Label + Category Badge
**Epic:** FDIS | **Priority:** HIGH | **Type:** Story
**Estimate:** 2 points

**Problem:** Fund cards show only name + 1Y return. User cannot make any investment decision. Kuvera shows category, 3Y/5Y, AUM, risk label.

**Acceptance Criteria:**
- [ ] Fund card shows: Fund name + AMC name + Category badge + AUM (e.g. "₹12,450 Cr") + Expense ratio + 1Y/3Y return
- [ ] Risk level badge: Low (blue) / Moderate (amber) / High (red) — derived from `std_dev` or category
- [ ] AUM formatted: Cr for >100Cr, L for <100Cr
- [ ] Card height: max 80px (compact) — no overflow
- [ ] Data sourced from CSV ingest fields (DATA-002 must be complete)

**Graph nodes:** `ui_audit_problems_fundcard_insufficientdata`
**Depends on:** DATA-002

---

## SPRINT 20 — POLISH + MARKETS UX
**Goal:** Close the gap with Kuvera on every table-stakes feature.

---

### [MKTS-001] Markets Screen — Sector Grid → Horizontal Scroll Row
**Epic:** MKTS | **Priority:** HIGH | **Type:** Story
**Estimate:** 2 points

**Problem:** 2×8 sector grid = 8 rows requiring 12-15 scrolls before FII/DII and Gainers/Losers. Buries more actionable content.

**Acceptance Criteria:**
- [ ] Sectors section: single `SizedBox(height: 90)` + `ListView.builder(scrollDirection: Axis.horizontal)`
- [ ] Each sector tile: 80×80px, sector name, % change, color coded
- [ ] Section freed: FII/DII now visible ~3 scrolls from top (previously ~12)
- [ ] Performance: `ListView` uses `itemExtent` for constant-time layout

**Graph nodes:** `ui_audit_problems_sectorgrid_scrollhell`

---

### [MKTS-002] Markets Screen — Market Open/Closed Indicator
**Epic:** MKTS | **Priority:** MEDIUM | **Type:** Story
**Estimate:** 1 point

**Problem:** No indicator of whether market is open or closed. App shows data with no temporal context. User doesn't know if numbers are live or stale.

**Acceptance Criteria:**
- [ ] Pill indicator in AppBar or below header: "Market Open" (green pulse dot) or "Market Closed" (grey) or "Pre-Open" (amber)
- [ ] Computed from IST time: open Mon-Fri 09:15-15:30
- [ ] If closed: shows "Opens in Xh Ym" countdown
- [ ] If open: shows "Closes in Xh Ym"
- [ ] No API call needed — purely time-based computation

**Graph nodes:** `ui_audit_problems_missing_marketstatusindicator`

---

### [MKTS-003] FII/DII — 5-Day Trend Sparkline
**Epic:** MKTS | **Priority:** MEDIUM | **Type:** Story
**Estimate:** 2 points

**Problem:** FII/DII section shows only today's buy/sell numbers. No trend. One number without trend is near-zero intelligence.

**Acceptance Criteria:**
- [ ] Small sparkline (5 bars or 5-point line) showing net FII buy/sell for last 5 trading days
- [ ] Data sourced from `/api/market-state` or scraper DB table
- [ ] Bar: green for net buy, red for net sell
- [ ] Tooltip on tap: exact date + net value
- [ ] Max height: 40px — compact, doesn't bloat section

**Graph nodes:** `ui_audit_problems_fii_dii_nosparkline`

---

### [POLH-001] Wire Haptic Feedback Across All CTAs
**Epic:** POLH | **Priority:** MEDIUM | **Type:** Story
**Estimate:** 1 point

**Problem:** `haptics.dart` exists at `vmfs_flutter/lib/core/haptics.dart` but is unwired to any interactions.

**Acceptance Criteria:**
- [ ] All primary CTAs: `HapticFeedback.mediumImpact()` (SIP button, Invest button, Goal create)
- [ ] All toggles: `HapticFeedback.selectionClick()` (Direct/Regular toggle, period buttons)
- [ ] All state changes (skeleton → data loaded): `HapticFeedback.lightImpact()`
- [ ] Error states: no haptic (errors should not feel "satisfying")
- [ ] `flutter analyze` clean after changes

**Graph nodes:** `ui_audit_problems_nohapticfeedback`, `ui_audit_problems_haptics_dart`

---

### [POLH-002] Goals Screen — Probability Context (GREEN/AMBER/RED)
**Epic:** POLH | **Priority:** MEDIUM | **Type:** Story
**Estimate:** 2 points

**Problem:** Goal success probability shown as raw "73%". No visual context. Monte Carlo engine already outputs GREEN/AMBER/RED status.

**Acceptance Criteria:**
- [ ] Replace/augment percentage number with colored status indicator:
  - GREEN: large pulsing emerald dot + "On Track"
  - AMBER: amber dot + "Needs Attention"
  - RED: red dot + "At Risk"
- [ ] Percentage shown as secondary info (smaller, below status)
- [ ] Tapping opens explanation bottom sheet: "At current SIP rate, you reach your goal in 2031. To reach it by 2029, increase SIP by ₹2,000/month."
- [ ] Status derived from existing Gemini/MC output (no new computation)

**Graph nodes:** `ui_audit_problems_goals_probabilitycontext`, `ui_audit_problems_monte_carlo_engine`

---

### [POLH-003] Calculator — What-If SIP Slider
**Epic:** POLH | **Priority:** MEDIUM | **Type:** Story
**Estimate:** 3 points

**Problem:** Calculators are static. No interactivity beyond input fields. A live SIP slider that updates projections in real time would be a unique differentiator (no competitor has this on mobile).

**Acceptance Criteria:**
- [ ] SIP calculator: add `Slider` widget for monthly amount (₹500 – ₹1L, step ₹500)
- [ ] Sliders drives real-time computation (debounced 100ms) — fully offline
- [ ] Output updates: final corpus + chart re-renders without network call
- [ ] "Save to Goals" button at bottom: pre-fills Goal creation with calculated values
- [ ] Smooth animation on chart re-render (not jarring jump)

**Graph nodes:** `ui_audit_problems_goalscreen_nowhatifslider`, `ui_audit_problems_calculator_nosavetogoals`

---

### [POLH-004] Expanded Holdings — Show Fund Quality Data
**Epic:** POLH | **Priority:** MEDIUM | **Type:** Story
**Estimate:** 2 points

**Problem:** `_ExpandableHolding` in portfolio_screen.dart expands to show only invested vs current + P&L. Missing: fund category, rating, 1Y/3Y return, expense ratio.

**Acceptance Criteria:**
- [ ] Expanded state adds second row: Category | 1Y Return | Expense Ratio
- [ ] 1Y return color coded (emerald if positive, red if negative)
- [ ] "Beat Nifty" badge if fund 1Y return > Nifty 50 1Y return
- [ ] Expense ratio shown as "0.15% p.a." with tooltip "Lower is better"
- [ ] Data sourced from `fund_returns` + `funds` tables via existing API

**Depends on:** DATA-002, DATA-004

---

## SPRINT 21+ — MOAT FEATURES (After Data Quality Verified)

---

### [AIMT-001] CAS Import — NSDL/CDAS Portfolio Import
**Epic:** AIMT | **Priority:** HIGH | **Type:** Story
**Estimate:** 8 points

**Problem:** The single biggest acquisition hook missing. Without CAS import, fund overlap analysis and AI portfolio health report are impossible on real user data. INDmoney's #1 feature.

**Acceptance Criteria:**
- [ ] NSDL CAS email parsing: user uploads CAS PDF → backend parses → holdings extracted
- [ ] Alternatively: CDAS API integration if available
- [ ] Holdings written to `portfolio_holdings` table with source=CAS
- [ ] Import button in Dashboard is functional (removes TRUST-001 stopgap)
- [ ] Conflict resolution: CAS holdings vs manually entered holdings
- [ ] PII handling: no PAN stored in plaintext (encryption.ts)

**Graph nodes:** `data_pipeline_handoff_casimport_feature`, `ui_audit_problems_cas_import_feature`
**Blocks:** AIMT-002, AIMT-003

---

### [AIMT-002] Fund Overlap Analysis
**Epic:** AIMT | **Priority:** HIGH | **Type:** Story
**Estimate:** 5 points

**Problem:** No competitor offers stock-level overlap detection. Core moat feature. Requires CAS import + holdings data from PDF engine.

**Acceptance Criteria:**
- [ ] Post CAS import: compute stock overlap matrix across all user's funds
- [ ] Heatmap: "You own Reliance Industries via 7 of your 9 funds (18% concentration)"
- [ ] Redundancy score per fund pair: "Navi Large Cap + Mirae Large Cap: 87% overlap — one is redundant"
- [ ] Diversification quality score (actual holdings diversity, not just fund count)
- [ ] Share/export as PDF report

**Depends on:** AIMT-001, PDF engine holdings data

---

### [AIMT-003] AI Portfolio Health Report (Gemini)
**Epic:** AIMT | **Priority:** HIGH | **Type:** Story
**Estimate:** 5 points

**Problem:** Post-CAS-import, Gemini should generate a contextual portfolio health report — specific to this user's actual holdings.

**Acceptance Criteria:**
- [ ] Triggered after CAS import completes
- [ ] Gemini prompt: user's holdings + benchmark performance + risk metrics → structured JSON report
- [ ] Report sections: Portfolio quality, overlap, benchmark comparison, actionable recommendations
- [ ] Displayed in new "Portfolio Intelligence" screen (Sprint 21)
- [ ] Not classified as "advice" — framed as analytics/observation (SEBI compliance)

**Depends on:** AIMT-001, AIMT-002, DATA-004

---

## SPRINT 21+ — WEBSITE & SEO

---

### [WSEO-001] Google Search Console Audit + Indexing Fixes
**Epic:** WSEO | **Priority:** HIGH | **Type:** Task
**Estimate:** 3 points

**Acceptance Criteria:**
- [ ] Check Search Console for all unindexed pages
- [ ] Fix: noindex tags on fund detail pages (if present)
- [ ] Fix: robots.txt blocking /funds/ or /learn/ paths (if present)
- [ ] Fix: missing SSR on fund detail pages (must be server-rendered for indexing)
- [ ] Verify: /api/sitemap.xml dynamically includes all 14,000+ fund pages
- [ ] Submit updated sitemap to Search Console
- [ ] Priority pages indexed: /funds/[scheme_code], /learn/[slug], /about, /disclosures

**Graph nodes:** `data_pipeline_handoff_googlesearchconsole_audit`, `data_pipeline_handoff_sitemap_verification`

---

### [WSEO-002] Website Fund Detail Page Data Audit
**Epic:** WSEO | **Priority:** HIGH | **Type:** Task
**Estimate:** 2 points

**Acceptance Criteria:**
- [ ] After DATA-004 pipeline rerun: verify web fund detail pages show correct data
- [ ] Spot check 20 funds: AUM, expense ratio, 3Y/5Y returns, risk metrics
- [ ] Verify: fund house name matches AMC canonical name
- [ ] Fix any web-specific data rendering bugs (web vs Flutter may have divergent display logic)

**Graph nodes:** `data_pipeline_handoff_websitefunddetail_audit`
**Depends on:** DATA-004

---

## DEPENDENCY MAP (Critical Path)

```
DATA-001 (Parquet)
    ↓
DATA-002 (CSV)  ←──── parallel ──→  DATA-003 (Backfill)
    ↓                                     ↓
DATA-004 (Pipeline Rerun + Verify)
    ↓                    ↓               ↓
FDET-001              FDIS-003        PINT-004
(Risk Metrics)        (Fund Cards)    (Benchmark)
    ↓
AIMT-003 (AI Report)

TRUST-001/002/003 ← INDEPENDENT (no data dependency, ship immediately)
DSYS-001/002     ← INDEPENDENT (no data dependency, ship immediately)
AIMT-001 (CAS)   → AIMT-002 (Overlap) → AIMT-003 (AI Report)
```

---

## SPRINT 18 VELOCITY SUMMARY

| Story | Points | Type | Depends on |
|-------|--------|------|-----------|
| DATA-001 | 3 | Task | — |
| DATA-002 | 2 | Task | — |
| DATA-003 | 2 | Task | DATA-001 |
| DATA-004 | 1 | Task | DATA-001,2,3 |
| TRUST-001 | 1 | Bug | — |
| TRUST-002 | 1 | Bug | — |
| TRUST-003 | 1 | Bug | — |
| DSYS-001 | 5 | Story | — |
| DSYS-002 | 1 | Bug | — |
| **TOTAL** | **17** | | |

---

## DEFINITION OF DONE (All Stories)

- [ ] `flutter analyze` — 0 errors, 0 warnings (mobile stories)
- [ ] Tested on physical iPhone (iOS) — confirmed working
- [ ] No regressions in existing features (smoke test: Dashboard, Portfolio, Discover, FundDetail, Markets)
- [ ] Light mode and dark mode both verified
- [ ] No dead buttons, no silent failures, no raw exception strings visible to user
- [ ] DB changes: migration file created (`migrations/0XX_description.sql`), run via `gh workflow run run-migrations.yml`
