# TODOS

Tracked work items. Updated as items are completed or re-prioritized.

---

## ✅ Landed 2026-04-15 (same day as flagged)

- **A** — Log-vs-arithmetic mixing → commit `466d036` (Sortino + rolling_mean use `(EXP(log_mean*252)-1)*100`)
- **C** — Per-window sample-size gates (1y≥200, 3y≥600, 5y≥1000) → commit `466d036`
- **F** — Idle audit tx in `total_return.py` → commit `466d036` (own-scope `_audit()`)
- **H** — Per-scheme try/except in risk_ratios loop → commit `466d036`
- **L** — Single `now_ts` per run → commit `466d036`

## Still deferred

- B (stale tr_nav on remap) — needs staging table approach
- D (endpoint date mismatch) — 45min refactor of endpts CTE
- E (dup nav rows) — verify dup presence first; fix is trivial (`DISTINCT ON`) if needed
- G (beta percentile inverted) — either drop from METRICS or rank by `|β-1|`
- I / J / K / M / N / O remain as written below

---

## P0 — Math correctness (DATA-005 risk_ratios) — partially landed

Flagged 2026-04-15 by adversarial `/review`. A/C/F/H/L landed same-day.

### A — Log-return vs arithmetic-return convention mismatch (CRITICAL) ✅ LANDED (commit 466d036)
**File:** `scripts/scheme_pipeline/compute/risk_ratios.py` (Sortino + Alpha)
**Bug:** Numerator uses `mean_fr * 252 * 100` (log-return annualized) minus
`RISK_FREE_PCT` (simple arithmetic %). Log-mean-annualized ≠ arithmetic-annualized.
Systematically underestimates alpha by 50–300 bps for volatile funds.
**Fix:** Either convert mean_fr to arithmetic via `exp(mean_fr)-1` before
annualising, OR convert `RISK_FREE_PCT` to log-equivalent `ln(1+rf/100)`.
Pick one convention and apply consistently to beta cov/var AND alpha CAGR.
**Effort:** 1h + re-run pipeline.
**Confidence:** 9/10 (adversarial subagent).

### B — Stale `tr_nav` on Growth-sibling remap (CRITICAL) ✅ LANDED (commit 4ad2169)
**File:** `scripts/scheme_pipeline/compute/total_return.py` Phase 2
**Bug:** `IS DISTINCT FROM` guard skips rewrites. If master_fund_id grouping
changes (e.g. a scheme gets reclassified), IDCW's `tr_nav` keeps old
Growth sibling's NAV values forever. Silent data corruption.
**Fix:** Pre-nullify IDCW `tr_nav` before Phase 2 UPDATE. Or use a staging
table + atomic swap. Or add a `tr_nav_source_scheme_code` column so
mappings are explicit and re-derivable.
**Effort:** 30min + re-run pipeline.
**Confidence:** 10/10.

### C — Sample-size gate too lax (CRITICAL) ✅ LANDED (commit 466d036)
**File:** `scripts/scheme_pipeline/compute/risk_ratios.py:_compute_one`
**Bug:** `n_obs >= 60` accepts a 3-month-old fund as having valid
`alpha_5y` / `sortino_5y`. Values produced but meaningless.
**Fix:** Per-window gate:
  - 1y window: n_obs >= 200
  - 3y window: n_obs >= 600
  - 5y window: n_obs >= 1000
Null the respective window if short; don't fail the scheme entirely.
**Effort:** 15min + re-run.
**Confidence:** 9/10.

### D — Endpoint date mismatch fund vs bench (HIGH) ✅ LANDED (commit 23db0bd)
**File:** `scripts/scheme_pipeline/compute/risk_ratios.py:endpts` CTE
**Bug:** Correlated subqueries pick fund_start/end from nav_history,
bench_start/end from benchmark_data independently. On Yahoo gap days,
fund and bench start/end dates differ, but `years` denominator uses
nominal window length. Alpha silently wrong.
**Fix:** Use `joined` CTE's min/max `nav_date` as the canonical date
boundary; look up fund + bench NAVs at those exact dates.
**Effort:** 45min + re-run.
**Confidence:** 9/10.

### E — Duplicate (scheme_code, nav_date) rows inflate stats (HIGH) ✅ CLOSED — nav_history PK prevents dups structurally
**File:** `scripts/scheme_pipeline/compute/risk_ratios.py:fund_rets`
**Bug:** No unique constraint on `(scheme_code, nav_date)`. If duplicates
exist, LAG(dup/dup)=0 inflates n_obs and deflates σ → Sharpe/Sortino/IR
all read higher than reality.
**Fix:** Either (a) `SELECT DISTINCT ON (scheme_code, nav_date) ... ORDER BY
scheme_code, nav_date, nav_value DESC` in fund_rets/bench_rets, OR
(b) migration: UNIQUE index on nav_history + fail pipeline if violated.
**Effort:** 20min (a) / 1h (b).
**Confidence:** 9/10.

---

## P1 — Reliability / durability

### F — Idle audit transaction held across Phase 1 UPDATE (HIGH) ✅ LANDED (commit 466d036)
**File:** `scripts/scheme_pipeline/compute/total_return.py:run`
**Bug:** `with get_conn(commit=False)` audit block is entered BEFORE Phase 1,
so audit conn sits idle while Phase 1 UPDATE (millions of rows) runs.
Long idle transactions block VACUUM, pin WAL, risk pool exhaustion.
**Fix:** Close audit conn immediately after `fetchone`. Move audit into
own scope that exits before Phase 1.
**Effort:** 5min.
**Confidence:** 9/10.

### G — Beta percentile inverts quality signal (HIGH) ✅ LANDED (commit 4ad2169 — dropped from METRICS)
**File:** `scripts/scheme_pipeline/compute/percentile.py:METRICS`
**Bug:** `beta_1y` added to rank. Higher beta = higher rank. But for
defensive/debt/hybrid funds, high beta is BAD (more market risk).
Downstream `mv_top_funds` will rank high-beta sector funds above
low-beta stable funds.
**Fix:** Either (a) drop `beta_1y` from METRICS, OR (b) rank by
`ABS(beta - 1)` ascending (closer to 1 = better for index-like funds).
**Effort:** 10min.
**Confidence:** 7/10.

### H — No per-scheme try/except in risk_ratios loop (HIGH) ✅ LANDED (commit 466d036)
**File:** `scripts/scheme_pipeline/compute/risk_ratios.py:run`
**Bug:** One psycopg2 connection reset mid-loop crashes entire run.
Unflushed buffer lost, IngestionLogger exits with error.
**Fix:** Wrap `_compute_one` in try/except, count errors, flush buffer
in `finally`.
**Effort:** 15min.
**Confidence:** 8/10.

---

## P2 — Hygiene / future-proofing

### I — `option_type ILIKE 'Growth%'` over-match (MEDIUM)
**File:** `scripts/scheme_pipeline/compute/total_return.py` Phase 1/2
**Bug:** Pattern matches "Growth Reinvestment" or "Growth - Direct"
variants if they exist. Haven't verified distinct values in prod.
**Fix:** Probe `SELECT DISTINCT option_type FROM funds` → build explicit
`IN (...)` list.
**Effort:** 10min.
**Confidence:** 6/10.

### J — `.format(col=col)` SQL composition in percentile.py (MEDIUM)
**File:** `scripts/scheme_pipeline/compute/percentile.py:_RANK_SQL`
**Bug:** Python string formatting inside SQL. Safe today (METRICS values
hardcoded). Latent SQL injection if future dev adds user-derived keys.
**Fix:** Comment warning + switch to `psycopg2.sql.Identifier` for column
names.
**Effort:** 15min.
**Confidence:** 6/10.

### K — Multiple Growth siblings per master_fund_id non-deterministic (MEDIUM) ✅ LANDED (commit 4ad2169)
**File:** `scripts/scheme_pipeline/compute/total_return.py:_PHASE2_SQL`
**Bug:** If a master_fund_id has >1 Growth sibling (data quality issue:
Bonus + Growth, or merged families), UPDATE last-write-wins is nondeterministic.
**Fix:** Add `SELECT DISTINCT ON (i.scheme_code, nav_date)` with
deterministic `ORDER BY g.scheme_code`. Log when any IDCW scheme has >1
candidate sibling for future investigation.
**Effort:** 15min.
**Confidence:** 7/10.

### L — Per-row `datetime.utcnow()` timestamps (LOW) ✅ LANDED (commit 466d036)
**File:** `scripts/scheme_pipeline/compute/risk_ratios.py:_compute_one`
**Bug:** Timestamp captured per scheme → different `updated_at` per row
within one run. Downstream "all rows from latest pipeline run" queries
can't group by timestamp.
**Fix:** Capture single `now = datetime.utcnow()` in `run()` and reuse.
**Effort:** 2min.
**Confidence:** 8/10.

### M — No winsorization of extreme daily returns (LOW/MEDIUM)
**File:** `scripts/scheme_pipeline/compute/risk_ratios.py:fund_rets`
**Bug:** Post-split NAV crash (e.g. 90% drop overnight) produces huge
negative log-return that dominates variance calc → Sharpe wildly wrong
for that scheme's window.
**Fix:** Clip `|ret| > 0.5` as data error, exclude from aggregates, emit
per-scheme outlier audit in metadata.
**Effort:** 20min.
**Confidence:** 7/10.

### N — `POWER(end/start, 1/years)` overflow on thin windows (MEDIUM)
**File:** `scripts/scheme_pipeline/compute/risk_ratios.py:cagrs`
**Bug:** If `years < 0.01` clamp triggered, exponent = 100; ratio 1.5
gives 1.5^100 ≈ 4e17, overflows `numeric`.
**Fix:** Require `years >= 0.25` (3 months) before computing CAGR; else
emit NULL.
**Effort:** 5min.
**Confidence:** 8/10.

### O — Staging table + atomic swap for partial-crash safety (MEDIUM)
**File:** `scripts/scheme_pipeline/compute/risk_ratios.py` UPSERT strategy
**Bug:** Streaming UPSERT every 500 schemes prevents total-work-loss but
creates heterogeneous snapshots: on crash, some schemes have today's
ratios, others have yesterday's. Percentile ranks computed later compare
across generations.
**Fix:** Write to `fund_returns_staging`; atomic swap at end. Or add
`risk_computed_at` column; percentile filters to rows updated within
last N hours.
**Effort:** 2h.
**Confidence:** 8/10.

---

## Deferred (by user 2026-04-15)

Items A–O above logged as TODOs. User chose to defer math-correctness
fixes in favor of Path F (real NSE/CRISIL TRI ingestion) which removes
the price-proxy benchmark skew at the source. After Path F lands, revisit
A–E first: the true-TRI data will amplify alpha-bias magnitude, making
Fix A more urgent.
