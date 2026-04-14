"""rolling_returns — compute 1Y / 3Y / 5Y / 10Y CAGR per scheme.

Input:    nav_history (or tr_nav when IDCW dividend-adjusted)
Output:   fund_returns.returns_{1y,3y,5y,10y}

Window semantics (CFA-aligned):
  - Point-to-point CAGR between NAV on (as_of - window) and as_of.
  - Uses tr_nav if present (IDCW-adjusted), else nav_value (growth plans).
  - Null if insufficient history (no NAV within +/- 5 calendar days of window start).
"""
from __future__ import annotations

import logging

from ..core.logger import IngestionLogger

log = logging.getLogger(__name__)

SOURCE = "compute"
JOB = "rolling_returns"


def run() -> int:
    with IngestionLogger(source=SOURCE, job_name=JOB) as logger:
        # TODO(DATA-001): implement with a single SQL pass using window fns
        # over nav_history. Stubbed for scaffold.
        written = 0
        logger.set_row_count(written)
        logger.mark_partial()
        logger.meta({"note": "stub; see DATA-001"})
        return written


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(f"wrote {run()} rows")
