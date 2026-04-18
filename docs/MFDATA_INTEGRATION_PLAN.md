# mfdata.in — Integration Plan & Task List
**Created:** 2026-04-18
**Source:** https://mfdata.in/docs — OpenAPI: https://mfdata.in/openapi.json

---

## TL;DR — THIS IS A GAME-CHANGER

**mfdata.in is a free, MIT-licensed, no-auth API covering 14,544 Indian mutual fund schemes with data we were going to spend 6+ sprints building ourselves.**

- **Killer endpoint: `/api/v1/overlap`** — returns stock-level fund overlap matrix with weights. This IS AIMT-002 Fund Overlap Analysis (an 8-point story on our Jira board). Available in one GET call.
- **Full risk metrics** on every scheme: Sharpe, alpha, beta, Sortino, std dev, R², Jensen's alpha, Treynor ratio, information ratio — with category averages pre-computed.
- **Portfolio holdings** for 6,813 schemes (47% coverage) with monthly history.
- **Fund fundamentals**: PE, PB, PS, ROE, ROA, dividend yield.
- **Expense ratio, AUM, min_sip, min_lumpsum, exit_load** — the 3 columns still at 0% after DATA-002.
- **Morningstar rating + risk label** per scheme.
- **Category ranks** (percentile rank within SEBI category).
- Rate limit: **120 req/min, 10,000 req/day per IP**. Plenty for cached backend use.

---

## WHAT WE GET (vs what we currently have)

### Data We're MISSING that mfdata.in PROVIDES

| Field | Our current state | mfdata.in |
|-------|-------------------|-----------|
| `expense_ratio` | 0% fill | 100% for active |
| `exit_load` | 0% fill | 100% (HTML formatted) |
| `min_sip` | 0% fill | 100% |
| `min_lumpsum` | no column | Available |
| Morningstar rating | no column | 1-5 stars |
| Risk label (Low/Moderate/High) | no column | Text label |
| Benchmark name | no column | e.g. "BSE 500 India TR INR" |
| Sharpe ratio | ~20% (after parquet) | 100% for families with data |
| Sortino ratio | sparse | 100% |
| Beta / Alpha | sparse | 100% |
| Standard deviation | sparse | 100% |
| R² | no column | Available |
| Jensen's alpha | no column | Available |
| Treynor ratio | no column | Available |
| Information ratio | no column | Available |
| PE, PB, PS ratios | no column | Available (portfolio-weighted) |
| ROE, ROA | no column | Available |
| Dividend yield | no column | Available |
| Category averages | no | Pre-computed (sharpe, beta, PE avg) |
| Category rank 1M/3M/6M/1Y/3Y/5Y | no | 1-N rank in category |
| Portfolio holdings (equity+debt+cash) | ~1,200 schemes via PDF engine | 6,813 schemes |
| Monthly holdings history | no | Available |
| Fund overlap matrix | no | Pre-computed in one call |
| Stock holders ("which funds own TCS?") | no | Available |
| Asset allocation (stock/bond/cash/other %) | no | Available |
| Sector allocation | ~1,200 schemes via PDF engine | 2,906 families |
| Credit quality breakdown (AAA-D) | no | Available (debt funds) |
| Fund managers + team | sparse | Available |
| Capture ratios | no | Available (where data) |
| Max drawdown | no | Available |
| Annual returns history | sparse | Full history |
| Growth of 10K chart data | no | Available |

### Data We Have That mfdata.in DOES NOT

| Field | Source |
|-------|--------|
| Full 21M NAV history 2006-2026 | Our parquet ingest |
| Custom AMC slug to our canonical AMC mapping | Our DB |
| Our computed `mv_top_funds` quality score | Our logic |
| User portfolio holdings (CAS) | Our DB (future) |

**Conclusion:** mfdata.in is a near-perfect complement, not a replacement. Use it to **fill the gaps** and **pre-compute what we can't compute ourselves cheaply**.

---

## INTEGRATION ARCHITECTURE

**Critical design decision: NEVER call mfdata.in from the Flutter app directly.**

Reasons:
1. Rate limit is per-IP — 10K users = instant ban
2. We'd be dependent on their uptime (their `/stats` shows 4-day uptime = very young service)
3. Can't cache or enrich responses
4. Leaks our users' usage patterns to a third party

**Correct architecture:**

```
Flutter App  →  vmfinancialservices.com (our backend)  →  [cache layer]  →  mfdata.in
                         ↓
                  Our PostgreSQL (canonical store)
```

**Pattern:**
- Our backend has a `mfdata_sync` worker (GitHub Actions cron or Railway cron)
- Worker fetches mfdata.in endpoints, writes to our DB columns
- Flutter reads from our DB via existing `/api/funds/*` endpoints
- Flutter never knows mfdata.in exists
- Cache mfdata.in responses in Redis/in-memory for 5 min (matches their `cache-control: 300`)

**Sync cadence by endpoint:**
| Endpoint | Sync frequency | Rationale |
|---------|----------------|-----------|
| `/stats` | Daily | Monitor coverage |
| `/schemes/{code}` | Daily for active Direct Growth (~1,600 schemes) | Fills expense_ratio, AUM, ratios |
| `/schemes/{code}/returns` | Weekly | Returns change monthly |
| `/families/{id}/holdings` | Monthly | Holdings disclosed monthly |
| `/families/{id}/sectors` | Monthly | Derived from holdings |
| `/families/{id}/ratios` | Weekly | Mostly trailing calculations |
| `/families/{id}/risk-detail` | Weekly | Risk metrics slow-moving |
| `/new-schemes` | Daily | NFO discovery |
| `/top-performers` | Daily | Leaderboard freshness |
| `/overlap` | On-demand per user request | Personalized, cache 24h |

**Rate budget math:**
- 1,600 Direct Growth funds × 1 daily call = 1,600/day (16% of daily quota)
- Holdings sync monthly: 2,906 families × 1/month = ~100/day avg
- Total baseline: <3,000/day, well under 10,000/day ceiling

---

## TASK LIST — PRIORITIZED

Tasks organized as **Jira-style stories** aligned with our existing Sprint 18/19/20 board. New epic: **MFD** (mfdata.in integration).

---

### ⚡ SPRINT 18 — CRITICAL WINS (this week)

#### [MFD-001] Build mfdata.in Sync Worker — Core Infrastructure (3pt, P0)
**Why first:** Everything else depends on the sync layer.

**Tasks:**
- [ ] Create `scripts/mfdata-sync.py` — generic client with rate-limit aware backoff
- [ ] Helper: `fetch_with_cache(endpoint, ttl_seconds)` — respects their cache-control headers
- [ ] Helper: `upsert_scheme_metadata(scheme_code, data)` — writes expense_ratio, exit_load, min_sip, aum, min_lumpsum to `funds`
- [ ] Helper: `upsert_scheme_ratios(scheme_code, ratios_obj)` — writes Sharpe/alpha/beta/Sortino/std_dev/r_squared to `fund_returns`
- [ ] Rate budget: max 100 req/min (leaves 20 req/min headroom), max 8,000 req/day (leaves 20% margin)
- [ ] Log rate-limit headers `x-ratelimit-remaining`, `x-ratelimit-daily-remaining` on every request
- [ ] Dry-run mode `--dry-run`
- [ ] Checkpoint file `/tmp/mfdata_sync_checkpoint.json`

**Schema additions needed:**
```sql
ALTER TABLE funds ADD COLUMN IF NOT EXISTS min_lumpsum NUMERIC;
ALTER TABLE funds ADD COLUMN IF NOT EXISTS morningstar_rating SMALLINT;
ALTER TABLE funds ADD COLUMN IF NOT EXISTS risk_label VARCHAR(30);
ALTER TABLE funds ADD COLUMN IF NOT EXISTS benchmark_name VARCHAR(100);
ALTER TABLE funds ADD COLUMN IF NOT EXISTS mfdata_family_id INTEGER;
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS r_squared NUMERIC;
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS jensens_alpha NUMERIC;
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS treynor_ratio NUMERIC;
ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS information_ratio NUMERIC;
CREATE TABLE IF NOT EXISTS fund_fundamentals (
    scheme_code VARCHAR(20) PRIMARY KEY,
    pe_ratio NUMERIC, pb_ratio NUMERIC, ps_ratio NUMERIC,
    dividend_yield NUMERIC, roe NUMERIC, roa NUMERIC,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

Create as `migrations/013_mfdata_columns.sql`, deploy via `run-migrations.yml`.

---

#### [MFD-002] Initial Bulk Sync — Direct Growth Scheme Metadata (2pt, P0)
**Why:** This fills the 3 remaining 0%-fill columns (`expense_ratio`, `exit_load`, `min_sip`) from DATA-002. **This is the actual completion of DATA-002.**

**Tasks:**
- [ ] Run `mfdata-sync.py --mode scheme-details --filter direct-growth`
- [ ] Iterates 1,600-2,400 active Direct Growth funds
- [ ] Populates: `expense_ratio`, `exit_load`, `min_sip`, `min_lumpsum`, `fund_size` (AUM), `morningstar_rating`, `risk_label`, `benchmark_name`, `mfdata_family_id`
- [ ] Expected runtime: ~25 min (at 1 req/sec to stay safely under 120/min)
- [ ] Verify fill rate post-sync — target 80%+ for Direct Growth

**Unblocks:** Fund card in Discover (FDIS-003), Fund Detail Quick Facts (FDET-001 partial).

---

#### [MFD-003] Fund Detail Ratios Sync (2pt, P0)
**Why:** This is the **real unlock for FDET-001 Risk Metrics Section**, bigger impact than DATA-004 pipeline rerun.

**Tasks:**
- [ ] `mfdata-sync.py --mode ratios --filter direct-growth`
- [ ] Endpoint: `/api/v1/schemes/{code}` (ratios nested in response)
- [ ] Populates `fund_returns`: Sharpe, Sortino, alpha, beta, std_dev, r_squared, treynor_ratio, jensens_alpha, information_ratio
- [ ] Also write to new `fund_fundamentals` table: PE, PB, PS, ROE, ROA, dividend yield
- [ ] Category averages — cache in a lightweight `category_benchmarks` table (one row per category+period)

**Expected:** ~1,600 API calls, ~25 min.

**Unblocks:** FDET-001 (risk metrics), FDET-004 (returns table with percentile rank).

---

### 🎯 SPRINT 19 — DIFFERENTIATION

#### [MFD-004] Portfolio Overlap Endpoint — Wire to Flutter (5pt, HIGH)
**Why:** This turns the 8-point AIMT-002 story into a 5-point integration.

**Tasks:**
- [ ] Create backend endpoint `GET /api/portfolio/overlap?scheme_codes=...`
- [ ] Server-side: call `mfdata.in/api/v1/overlap` with cache TTL 24h (rarely changes)
- [ ] Transform response: add our fund names, AMC logos, category labels
- [ ] Flutter: new screen `PortfolioOverlapScreen` — heatmap of common stocks with weights
- [ ] Flutter: "Find Overlap" CTA in Portfolio screen after CAS import (when ready)
- [ ] For each user's holdings, auto-compute pairwise overlap on portfolio load (cache)
- [ ] Display: "You own Reliance Industries via 3 of your 5 funds (18% concentration)"

**Dependencies:** CAS import (AIMT-001) needed for real user portfolio. Can ship with manual scheme selection first.

---

#### [MFD-005] Fund Detail Holdings Section (3pt, HIGH)
**Why:** FundDetailScreen holdings section currently empty for ~80% of schemes. mfdata.in has 6,813 covered.

**Tasks:**
- [ ] `mfdata-sync.py --mode holdings --filter all-families` (monthly cron)
- [ ] Endpoint: `/api/v1/families/{family_id}/holdings`
- [ ] Write to our `fund_top_holdings` table (already exists from PDF engine)
- [ ] Conflict: PDF engine also writes here. Use `source='mfdata'` vs `source='pdf'` to dedupe; prefer mfdata when both present (richer)
- [ ] Also `/api/v1/families/{family_id}/sectors` → `scheme_sector_summary` table
- [ ] Flutter: FundDetailScreen holdings section now populated for ~6,800 funds (was ~1,200)

**Closes FDET-002** (empty data states) for the majority of funds.

---

#### [MFD-006] Top Performers Live Leaderboard (2pt, MEDIUM)
**Tasks:**
- [ ] Proxy `/api/v1/top-performers?period=1y&category=Flexi+Cap&limit=10`
- [ ] Backend: `GET /api/funds/top-performers?period=...&category=...`
- [ ] Flutter: HomeScreen "Top Performing Funds" section uses this (currently uses stale `mv_top_funds`)
- [ ] Add period chips: 1M / 3M / 6M / 1Y / 3Y / 5Y
- [ ] Category filter dropdown

---

#### [MFD-007] Compare Screen — New Feature (3pt, MEDIUM)
**Why:** mfdata.in `/compare` supports side-by-side for up to 10 schemes. No competitor does this well on mobile.

**Tasks:**
- [ ] Flutter: new `CompareScreen` reachable from DiscoverScreen + FundDetail
- [ ] User picks 2-5 funds → parallel call to our backend → backend calls mfdata.in `/compare`
- [ ] Display: returns 1M-5Y side-by-side, Sharpe/alpha/beta side-by-side, expense ratio side-by-side, holdings overlap if available
- [ ] Highlight cells where fund beats others (color-coded winner per row)

---

### 🛠 SPRINT 20 — INFRASTRUCTURE

#### [MFD-008] mfdata-sync Daily Cron (1pt)
**Tasks:**
- [ ] Add `mfdata-sync-daily.yml` GitHub Actions workflow (schedule: `0 18 * * *` — 11:30 PM IST, after AMFI daily-update)
- [ ] Runs scheme details + top-performers refresh
- [ ] Expected budget: ~1,600 req/day

#### [MFD-009] mfdata-sync Monthly Holdings Cron (1pt)
**Tasks:**
- [ ] `mfdata-sync-monthly.yml` — runs 5th of each month (after AMCs disclose holdings)
- [ ] Fetches all `families/{id}/holdings` + `/sectors`
- [ ] Budget: ~3,000 req across one day
- [ ] Post-run: refresh `mv_unified_search` if holdings drive search

#### [MFD-010] Health Monitoring + Fallback (2pt)
**Tasks:**
- [ ] Poll `mfdata.in/api/v1/uptime` and `/stats` daily, log to monitoring
- [ ] If 3 consecutive failures: alert + skip sync for that cycle
- [ ] Flutter: on read from our DB, show "Data last updated N days ago" footer on Fund Detail if >7 days stale
- [ ] Fallback: our existing parquet + daily-update cron remains authoritative for NAV — mfdata.in only enriches metadata/ratios

---

### 🔬 SPRINT 21+ — MOAT AMPLIFICATION

#### [MFD-011] Stock Holders Feature — "Where are you really invested?" (3pt)
**Why:** mfdata.in `/stocks/{stock_name}/holders` returns "all mutual funds that hold this stock." Unique feature, nobody in India does this.

**Tasks:**
- [ ] User drills into their portfolio → sees aggregate stock exposure
- [ ] Tap a stock (e.g. "Reliance Industries") → see all funds that hold it, with weights
- [ ] Exposes concentration risk across the portfolio
- [ ] Flutter: `StockExposureScreen` reachable from portfolio-overlap analysis

#### [MFD-012] Credit Quality Visualization (Debt Fund Screens) (2pt)
**Tasks:**
- [ ] For debt/hybrid funds in FundDetail: new "Credit Quality" section
- [ ] Uses `/api/v1/families/{id}/credit-quality`
- [ ] Visual: stacked bar AAA / AA / A / BBB / Below BBB / Not Rated with category comparison line

#### [MFD-013] Capture Ratios + Max Drawdown in FundDetail (2pt)
**Tasks:**
- [ ] Add "Up Capture / Down Capture" metrics — shows fund behavior in rising vs falling markets
- [ ] Add "Max Drawdown" with date of peak and trough
- [ ] Data from `/api/v1/families/{id}/risk-detail`

---

## RISKS & MITIGATIONS

### Risk 1: mfdata.in shuts down or goes paid
**Signal:** 4-day uptime, small team, MIT license in README only
**Mitigation:**
- We never rely on it as sole source — our parquet + AMFI daily are authoritative for NAV
- We sync and persist to our DB — if mfdata goes down, we degrade gracefully to last-known values
- All UI reads from our DB, never live from mfdata.in

### Risk 2: Data accuracy / staleness
**Signal:** `/risk-detail` returned nulls for Parag Parikh — coverage varies
**Mitigation:**
- Log coverage rate per endpoint per sync
- Sprint 18 MFD-002 verification: report what % of Direct Growth we could successfully enrich
- Fall back to parquet-computed values for ratios when mfdata has nulls

### Risk 3: Rate limits tightened
**Mitigation:**
- Stay well under 10,000/day (we project ~3,000/day steady-state)
- Cache aggressively (24h for ratios, 7d for holdings)
- Monitor `x-ratelimit-daily-remaining` header

### Risk 4: ToS / attribution requirement
**Mitigation:**
- Read-only, non-commercial use case is fine per MIT
- Add "Data via mfdata.in" attribution in app footer/About screen
- Flag in `/about` page

---

## IMMEDIATE NEXT ACTIONS (TODAY)

If you want to start this integration immediately:

1. **MFD-001 migration** — write `migrations/013_mfdata_columns.sql` (10 min)
2. **MFD-001 client** — write `scripts/mfdata-sync.py` skeleton with rate limiter (30 min)
3. **MFD-002 initial sync** — run scheme details for Direct Growth (~25 min runtime)
4. **Verify** — check new fill rates, report

**Total time to first value: ~1 hour.** After that, `expense_ratio`, `exit_load`, `min_sip`, risk metrics all populated for Direct Growth. Sprint 19 FDET-001 risk metrics section becomes immediately shippable.

---

## DECISION REQUIRED

**Do we want to:**

**A) Pause current Sprint 18 board** (TRUST fixes, DSYS light theme) and **prioritize MFD-001/002/003 first** — because the data gain unlocks so many other stories that it would change the rest of the plan.

**B) Stay on current Sprint 18** (finish TRUST fixes + DSYS-001 migration in parallel with DATA-004 pipeline rerun) and **schedule MFD work for Sprint 19**.

Recommendation: **A**. The data unlock from MFD-001/002/003 is bigger than anything else on Sprint 18 except TRUST fixes. TRUST fixes are ~3 points total, can ship tomorrow. Light theme is 5 points, no rush. But MFD unlocks **5+ Sprint 19 stories** at once.

Suggested reorder:

**Day 1 (today/tomorrow):**
- MFD-001 + MFD-002 + MFD-003 (fills all data gaps) — ~7 pts
- TRUST-001/002/003 in parallel (3 pts, no code conflict)

**Day 2-3:**
- DATA-004 pipeline rerun (uses both parquet + mfdata for richest result)
- DSYS-001/002

**Day 4+:**
- MFD-004 (overlap) + MFD-005 (holdings) → Sprint 19 differentiation begins
