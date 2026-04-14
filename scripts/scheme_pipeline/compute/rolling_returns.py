"""rolling_returns — point-to-point CAGR per scheme (DATA-001).

Computes return_{1y,3y,5y,10y} from nav_history and upserts into fund_returns.

Method:
  For each scheme with a latest NAV (as_of):
    - Find NAV on (as_of - N_years) with +/- 7 day tolerance.
    - CAGR = (nav_today / nav_then)^(1/N) - 1, expressed as percent.
    - Absolute return (1Y) = (nav_today / nav_then - 1) * 100.
  Writes 1Y as absolute (industry convention), 3Y+ as CAGR.

Runs after adapters/amfi_nav.py. Safe to re-run — UPSERT is idempotent.
"""
from __future__ import annotations

import logging

from ..core.db import execute_batch, fetch_all
from ..core.logger import IngestionLogger

log = logging.getLogger(__name__)

SOURCE = "compute"
JOB = "rolling_returns"

# tr_nav fallback to nav_value — growth plans pass-through, IDCW uses tr_nav
# once total_return.py runs. Until then tr_nav is null for IDCW → those schemes
# get growth-equivalent returns (acceptable; dividend reinvestment assumption).
_COMPUTE_SQL = """
WITH latest AS (
  SELECT DISTINCT ON (scheme_code)
         scheme_code, nav_date AS as_of, COALESCE(tr_nav, nav_value) AS nav
  FROM nav_history
  WHERE nav_value > 0
  ORDER BY scheme_code, nav_date DESC
),
lookback AS (
  SELECT
    l.scheme_code,
    l.as_of,
    l.nav AS nav_now,
    (SELECT COALESCE(tr_nav, nav_value) FROM nav_history h
      WHERE h.scheme_code = l.scheme_code
        AND h.nav_date BETWEEN l.as_of - INTERVAL '1 year' - INTERVAL '7 days'
                           AND l.as_of - INTERVAL '1 year' + INTERVAL '7 days'
        AND h.nav_value > 0
      ORDER BY ABS(EXTRACT(EPOCH FROM (h.nav_date - (l.as_of - INTERVAL '1 year'))))
      LIMIT 1) AS nav_1y,
    (SELECT COALESCE(tr_nav, nav_value) FROM nav_history h
      WHERE h.scheme_code = l.scheme_code
        AND h.nav_date BETWEEN l.as_of - INTERVAL '3 years' - INTERVAL '7 days'
                           AND l.as_of - INTERVAL '3 years' + INTERVAL '7 days'
        AND h.nav_value > 0
      ORDER BY ABS(EXTRACT(EPOCH FROM (h.nav_date - (l.as_of - INTERVAL '3 years'))))
      LIMIT 1) AS nav_3y,
    (SELECT COALESCE(tr_nav, nav_value) FROM nav_history h
      WHERE h.scheme_code = l.scheme_code
        AND h.nav_date BETWEEN l.as_of - INTERVAL '5 years' - INTERVAL '7 days'
                           AND l.as_of - INTERVAL '5 years' + INTERVAL '7 days'
        AND h.nav_value > 0
      ORDER BY ABS(EXTRACT(EPOCH FROM (h.nav_date - (l.as_of - INTERVAL '5 years'))))
      LIMIT 1) AS nav_5y,
    (SELECT COALESCE(tr_nav, nav_value) FROM nav_history h
      WHERE h.scheme_code = l.scheme_code
        AND h.nav_date BETWEEN l.as_of - INTERVAL '10 years' - INTERVAL '7 days'
                           AND l.as_of - INTERVAL '10 years' + INTERVAL '7 days'
        AND h.nav_value > 0
      ORDER BY ABS(EXTRACT(EPOCH FROM (h.nav_date - (l.as_of - INTERVAL '10 years'))))
      LIMIT 1) AS nav_10y
  FROM latest l
)
SELECT
  scheme_code,
  CASE WHEN nav_1y  IS NOT NULL AND nav_1y  > 0
       THEN ((nav_now / nav_1y)  - 1) * 100 END AS return_1y,
  CASE WHEN nav_3y  IS NOT NULL AND nav_3y  > 0
       THEN (POWER(nav_now / nav_3y,  1.0/3.0) - 1) * 100 END AS return_3y,
  CASE WHEN nav_5y  IS NOT NULL AND nav_5y  > 0
       THEN (POWER(nav_now / nav_5y,  1.0/5.0) - 1) * 100 END AS return_5y,
  CASE WHEN nav_10y IS NOT NULL AND nav_10y > 0
       THEN (POWER(nav_now / nav_10y, 1.0/10.0) - 1) * 100 END AS return_10y
FROM lookback
WHERE nav_1y IS NOT NULL OR nav_3y IS NOT NULL
   OR nav_5y IS NOT NULL OR nav_10y IS NOT NULL;
"""

_UPSERT_SQL = """
INSERT INTO fund_returns
    (scheme_code, return_1y, return_3y, return_5y, return_10y, updated_at)
VALUES %s
ON CONFLICT (scheme_code)
DO UPDATE SET
    return_1y  = EXCLUDED.return_1y,
    return_3y  = EXCLUDED.return_3y,
    return_5y  = EXCLUDED.return_5y,
    return_10y = EXCLUDED.return_10y,
    updated_at = NOW();
"""


def run() -> int:
    with IngestionLogger(source=SOURCE, job_name=JOB) as logger:
        from datetime import datetime
        rows = fetch_all(_COMPUTE_SQL)
        now = datetime.utcnow()
        payload = [
            (r["scheme_code"], r["return_1y"], r["return_3y"],
             r["return_5y"], r["return_10y"], now)
            for r in rows
        ]
        written = execute_batch(_UPSERT_SQL, payload)
        logger.set_row_count(written)
        logger.meta({"candidates": len(rows)})
        return written


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(f"wrote {run()} rows")
