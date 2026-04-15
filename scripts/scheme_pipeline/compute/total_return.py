"""total_return — populate nav_history.tr_nav.

Design decision (2026-04-15): abandoned original plan of scraping AMFI
dividend history. AMFI's `DownloadRADividendHistoryReport_Po.aspx` and
`DownloadCorporateAction_Po.aspx` both 404 as of probe, and mfapi.in
does not expose dividends. Instead we exploit a structural invariant:

  For any IDCW scheme, its Growth sibling (same master_fund_id + same
  plan_type) is run by the same portfolio manager on the same assets,
  with the only operational difference being that Growth reinvests
  distributions internally. So:

        TR-NAV(idcw, t) ≡ ratio-equivalent of NAV(growth_sibling, t)

  Since all downstream return/risk math is ratio-based (nav_end/nav_start),
  we can directly write Growth's nav_value into the IDCW scheme's
  tr_nav column — no scaling, no dividend table, no external fetch.

Phase 1: Growth schemes — tr_nav = nav_value (idempotent pass-through).
Phase 2: IDCW schemes — tr_nav = growth_sibling.nav_value on matching date.
         Rows with no Growth sibling (orphans, mergers) stay NULL;
         callers already COALESCE(tr_nav, nav_value) as fallback.

Idempotent. Re-runs overwrite deterministically.
"""
from __future__ import annotations

import logging

from ..core.db import get_conn
from ..core.logger import IngestionLogger

log = logging.getLogger(__name__)

SOURCE = "compute"
JOB = "total_return"

# Phase 1 — growth plans pass-through.
# Matches any option_type that indicates accumulation (Growth/Bonus/etc.).
_PHASE1_SQL = """
UPDATE nav_history nh
SET tr_nav = nh.nav_value
FROM funds f
WHERE f.scheme_code = nh.scheme_code
  AND f.option_type ILIKE 'Growth%'
  AND (nh.tr_nav IS DISTINCT FROM nh.nav_value);
"""

# Phase 2 — IDCW plans borrow Growth sibling's NAV.
# Sibling: same master_fund_id AND same plan_type (Direct↔Direct, Regular↔Regular).
_PHASE2_SQL = """
WITH sibling AS (
    SELECT i.scheme_code AS idcw_code,
           g.scheme_code AS growth_code
    FROM   funds i
    JOIN   funds g
      ON   g.master_fund_id = i.master_fund_id
     AND   g.plan_type       = i.plan_type
     AND   g.option_type    ILIKE 'Growth%'
    WHERE  (i.option_type ILIKE '%IDCW%' OR i.option_type ILIKE '%Dividend%')
      AND  i.master_fund_id IS NOT NULL
)
UPDATE nav_history nh
SET    tr_nav = g_nh.nav_value
FROM   sibling s
JOIN   nav_history g_nh
  ON   g_nh.scheme_code = s.growth_code
WHERE  nh.scheme_code = s.idcw_code
  AND  nh.nav_date    = g_nh.nav_date
  AND  (nh.tr_nav IS DISTINCT FROM g_nh.nav_value);
"""

# Coverage audit — how many IDCW schemes got linked, how many orphaned.
_AUDIT_SQL = """
WITH idcw AS (
    SELECT scheme_code, master_fund_id
    FROM   funds
    WHERE  option_type ILIKE '%IDCW%' OR option_type ILIKE '%Dividend%'
),
linked AS (
    SELECT DISTINCT i.scheme_code
    FROM   idcw i
    JOIN   funds g
      ON   g.master_fund_id = i.master_fund_id
     AND   g.option_type    ILIKE 'Growth%'
    WHERE  i.master_fund_id IS NOT NULL
)
SELECT
    (SELECT COUNT(*) FROM idcw)                            AS idcw_total,
    (SELECT COUNT(*) FROM linked)                          AS idcw_with_sibling,
    (SELECT COUNT(*) FROM idcw) - (SELECT COUNT(*) FROM linked) AS idcw_orphans;
"""


def _run_update(sql: str) -> int:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql)
        return cur.rowcount


def run() -> int:
    with IngestionLogger(source=SOURCE, job_name=JOB) as logger:
        with get_conn(commit=False) as conn, conn.cursor() as cur:
            cur.execute(_AUDIT_SQL)
            audit = cur.fetchone()
            idcw_total, idcw_with_sibling, idcw_orphans = audit
        log.info("total_return: phase 1 (growth pass-through)…")
        p1 = _run_update(_PHASE1_SQL)
        log.info("total_return: phase 1 updated %d nav rows", p1)
        log.info("total_return: phase 2 (idcw ← growth sibling)…")
        p2 = _run_update(_PHASE2_SQL)
        log.info("total_return: phase 2 updated %d nav rows", p2)
        total = p1 + p2
        logger.set_row_count(total)
        logger.meta({
            "phase1_growth_rows":  p1,
            "phase2_idcw_rows":    p2,
            "idcw_total":          idcw_total,
            "idcw_with_sibling":   idcw_with_sibling,
            "idcw_orphans":        idcw_orphans,
            "strategy":            "growth-sibling proxy (no external dividend fetch)",
        })
        return total


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    print(f"wrote {run()} rows")
