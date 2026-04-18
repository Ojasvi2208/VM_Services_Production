# TBD — Legacy Fund Cleanup

**Status:** TBD (defer until after Sprint 19 ships)
**Priority:** P3 (non-blocking, hygiene)
**Owner:** TBD
**Created:** 2026-04-18
**Context:** After DATA-001 parquet ingest (17.9M rows), DB now has 17,460 funds registered but only ~1,664 are actually UI-relevant (active Direct Growth with recent NAV). Rest is noise bloating search indexes, materialized views, and analytics computation.

---

## THE PROBLEM

Our `funds` table has **17,460 schemes**. Of these, only **1,664** (9.5%) are active Direct Growth plans with recent NAV — the only subset the Flutter UI meaningfully serves.

The remaining **15,796** funds fall into one or more "legacy" buckets. They:
- Bloat `mv_unified_search` — slower autocomplete, more noise in search results
- Skew `mv_top_funds` ranking — dead funds can win on historical metrics
- Consume pipeline compute — risk ratio calculation runs on funds nobody queries
- Pollute category/AMC filter dropdowns
- Waste DB storage (21.4M NAV rows, most for funds nobody views)

---

## LEGACY FUND CATEGORIES (with counts)

### Category A — CONFIRMED DEAD (high confidence, safe to hard-delete)

| Criterion | Count | SQL Filter |
|-----------|-------|-----------|
| `is_active=false` AND no NAV in 90 days | **3,107** | `is_active=false AND NOT EXISTS (SELECT 1 FROM nav_history n WHERE n.scheme_code=f.scheme_code AND n.nav_date >= NOW() - INTERVAL '90 days')` |
| Segregated portfolio (defaulted bond schemes) | **385** | `scheme_name ILIKE '%segregated%'` |
| Closed-ended schemes | **16** | `scheme_name ILIKE '%close ended%' OR scheme_name ILIKE '%closed-end%'` |
| Funds with zero NAV history (orphans) | **47** | `NOT EXISTS (SELECT 1 FROM nav_history n WHERE n.scheme_code=f.scheme_code)` |

**Total Category A (with overlap removed, est.):** ~3,300 funds

### Category B — SERIES / FMP / INTERVAL FUNDS (structural, UI-noise)

These are legitimately tradeable but are short-duration numbered series that create massive noise. Example: "HDFC FMP 1103D February 2021 (1)" through "HDFC FMP 1103D February 2021 (99)".

| Criterion | Count | Notes |
|-----------|-------|-------|
| FMP (Fixed Maturity Plans) | **2,720** | 99% are matured / redeemed |
| Numbered Series (`Series NNN`) | **3,707** | Most are matured close-ended issues |
| Interval funds | **282** | Rarely retail-relevant |

**Total Category B:** 6,709 funds (may overlap with A)

**Treatment:** Hide from UI (set `is_active=false`), keep in DB for historical reference (tax P&L may need them for users who held them).

### Category C — DEFUNCT AMCs (mergers/exits)

These AMCs have merged into other entities or exited the Indian market:

| AMC prefix | Count | Disposition |
|-----------|-------|-------------|
| Reliance (merged into Nippon India 2019) | 788 | Keep under "Nippon India" canonical AMC |
| BNP Paribas (merged into Baroda BNP Paribas) | 429 | Keep under canonical |
| Principal (acquired by Sundaram 2020) | 221 | Keep under Sundaram |
| IDFC (merged into Bandhan 2023) | 84 | Keep under Bandhan |
| Sahara (wound up by SEBI 2015) | 68 | HARD DELETE |
| Taurus (distressed, limited AUM) | 47 | Review — likely keep |

**Total Category C:** 1,637 funds

**Treatment:** Do NOT delete. Remap `amc_code` to the surviving canonical entity. User history must remain intact (a user who held Reliance Large Cap in 2018 needs that transaction visible today).

### Category D — WIND-UPS / FRANKLIN SEGREGATED (ongoing litigation / payout)

Franklin Templeton shut down 6 debt schemes in 2020; still in partial payout. Funds tagged with "Segregated Portfolio" are from defaulted bond exposures (DHFL, Essel, Vodafone, YES Bank AT1, etc.).

| Criterion | Count | Disposition |
|-----------|-------|-------------|
| Franklin wound-up + segregated | ~385 | Hide from UI, keep in DB until NAV=0 finalized |

---

## WHAT "KEEP" LOOKS LIKE

The clean post-cleanup `funds` table should contain approximately:

| Segment | Count | Why Keep |
|---------|-------|---------|
| Active Direct Growth w/ recent NAV | **1,664** | Primary UI target |
| Active Regular Growth w/ recent NAV | ~2,500 | Distributor plans (CAS import needs these) |
| IDCW variants of active funds | ~2,000 | Portfolio display for users who hold them |
| Recently launched NFOs (<180 days) | 383 | May not yet have NAV but must be discoverable |
| Merged-AMC funds held by users | ~500 | Preserves historical portfolio integrity |
| ETFs, Index funds, FoFs | ~500 | Discover page filters |
| **TOTAL KEEP** | **~7,500** | Down from 17,460 (57% reduction) |

---

## PROPOSED CLEANUP PLAN

### Phase 1 — SOFT HIDE (Sprint 20 candidate, non-destructive)
Add boolean column `funds.is_visible` defaulting to true. Run UPDATE to set `is_visible=false` for:

```sql
UPDATE funds SET is_visible=false WHERE
    is_active=false 
    OR scheme_name ILIKE '%segregated%'
    OR scheme_name ILIKE '%close ended%'
    OR (scheme_name ~* 'Series [0-9]+' AND NOT EXISTS (
        SELECT 1 FROM nav_history n WHERE n.scheme_code=funds.scheme_code 
        AND n.nav_date >= CURRENT_DATE - INTERVAL '180 days'
    ))
    OR (scheme_name ILIKE '%FMP%' AND NOT EXISTS (
        SELECT 1 FROM nav_history n WHERE n.scheme_code=funds.scheme_code 
        AND n.nav_date >= CURRENT_DATE - INTERVAL '180 days'
    ))
    OR scheme_name ILIKE '%interval%';
```

Update all search endpoints and `mv_unified_search` to filter `WHERE is_visible=true`.

**Expected effect:** ~10,000 funds hidden from UI, zero data loss, reversible.

### Phase 2 — PIPELINE FILTER (Sprint 21, compute savings)
Update `risk_ratios.py` and `run-pipeline.yml` to skip funds where `is_visible=false`. Cuts compute time ~60%.

### Phase 3 — HARD DELETE (Sprint 22+, after monitoring)
After 30 days of Phase 1 with zero user complaints:

1. Delete `nav_history` rows for Category A funds (`is_active=false` AND no NAV in 180d)
2. Delete orphan `funds` rows (47 funds with zero NAV history, 73 without `master_fund_id`)
3. Delete from `fund_returns`, `fund_top_holdings` where scheme_code no longer in funds
4. VACUUM FULL on nav_history

**Expected DB size reduction:** ~3-4 million nav_history rows deleted (~15% shrink).

---

## WHAT NOT TO DELETE (rules)

1. **NEVER delete a scheme any user currently holds.** Check `portfolio_holdings.scheme_code` before any DELETE.
2. **NEVER delete Direct plan if the corresponding Regular plan is kept** (master_funds linkage must remain intact).
3. **NEVER delete Franklin wound-up funds until official NAV=0** — users' tax records depend on them.
4. **NEVER delete NFOs <180 days old** even if no NAV yet — data pipeline catches up.
5. **NEVER delete merged-AMC funds** (Reliance, BNP, IDFC, Principal) — remap AMC canonical name instead.

---

## OUTSTANDING QUESTIONS

1. Do we have any `portfolio_holdings` rows referencing legacy scheme_codes? If yes — hide, don't delete.
2. Does the AMFI daily-update cron reintroduce schemes we've hidden? Need a `last_updated_in_source` flag to track.
3. What's the canonical AMC rename policy? Need a `master_amcs` table with merger history.
4. Do tax P&L calculations (for Pro tier) read historical scheme data? If yes, hidden schemes must remain queryable.
5. Should we split `funds` into `funds_active` (UI) + `funds_archive` (historical) — cleaner than a flag?

---

## DECISION GATES (BEFORE STARTING)

- [ ] Confirm no user `portfolio_holdings` references legacy schemes (query required)
- [ ] Confirm pipeline-rerun (DATA-004) performance gain from filtering — measure baseline first
- [ ] Design `master_amcs` merger table OR confirm we're OK with current AMC fragmentation
- [ ] Choose Phase 1 approach: `is_visible` flag vs `funds_archive` table split
- [ ] Get sign-off from user — this changes what shows in Discover search
