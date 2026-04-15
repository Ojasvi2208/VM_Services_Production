"""percentile — peer-rank every scheme within its SEBI category.

For each metric in METRICS:
  1. Group schemes by funds.sub_category (SEBI category).
  2. Compute percent_rank() within the group.
  3. Upsert into scheme_percentile with today's as_of_date.

Unique constraint (scheme_code, metric, as_of_date) handles re-runs.

Extended 2026-04-15 post-DATA-005: sortino_3y, beta_1y rank columns
activated now that risk_ratios compute populates them.
"""
from __future__ import annotations

import logging
from datetime import date

from ..core.db import execute_batch, fetch_all
from ..core.logger import IngestionLogger

log = logging.getLogger(__name__)

SOURCE = "compute"
JOB = "percentile"

# Maps scheme_percentile.metric → column on fund_returns.
# Column names verified against prod schema 2026-04-14.
METRICS: dict[str, str] = {
    "return_1y":  "return_1y",
    "return_3y":  "return_3y",
    "return_5y":  "return_5y",
    "sharpe_1y":  "sharpe_ratio_1y",
    "alpha_3y":   "alpha_3y",
    "sortino_3y": "sortino_3y",
    # Fix G (TODOS.md): beta_1y removed. Raw beta rank is semantically
    # inverted for defensive funds (high beta ranked good = wrong).
    # Revisit with ABS(beta - 1) or category-aware ranking.
}

_RANK_SQL = """
    SELECT
        fr.scheme_code,
        f.sub_category AS peer_category,
        ROUND((percent_rank() OVER (
            PARTITION BY f.sub_category
            ORDER BY fr.{col} NULLS LAST
        ) * 100)::numeric, 2) AS pct_rank,
        COUNT(*) OVER (PARTITION BY f.sub_category) AS peer_count
    FROM fund_returns fr
    JOIN funds f USING (scheme_code)
    WHERE fr.{col} IS NOT NULL
      AND f.sub_category IS NOT NULL;
"""

_UPSERT_SQL = """
    INSERT INTO scheme_percentile
        (scheme_code, metric, pct_rank, peer_count, peer_category, as_of_date)
    VALUES %s
    ON CONFLICT (scheme_code, metric, as_of_date)
    DO UPDATE SET
        pct_rank = EXCLUDED.pct_rank,
        peer_count = EXCLUDED.peer_count,
        peer_category = EXCLUDED.peer_category;
"""


def run(as_of: date | None = None) -> int:
    as_of = as_of or date.today()
    with IngestionLogger(source=SOURCE, job_name=JOB) as logger:
        total = 0
        for metric, col in METRICS.items():
            rows = fetch_all(_RANK_SQL.format(col=col))
            payload = [
                (r["scheme_code"], metric, r["pct_rank"], r["peer_count"], r["peer_category"], as_of)
                for r in rows
            ]
            # Oversized page_size avoids multi-page rowcount under-report
            # (latent bug in core/db.execute_batch).
            total += execute_batch(_UPSERT_SQL, payload, page_size=10_000)
        logger.set_row_count(total)
        logger.meta({"as_of": as_of.isoformat(), "metrics": list(METRICS)})
        return total


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(f"wrote {run()} rows")
