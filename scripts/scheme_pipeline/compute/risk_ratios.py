"""risk_ratios — populate the 16 ratio columns added in migration 023.

Inputs:
  - nav_history / tr_nav for the scheme
  - benchmark_data (TRI series) joined via scheme_benchmark_map
  - risk-free rate: 91-day T-Bill yield series (sourced from macro_snapshots)

Outputs (all on fund_returns):
  sharpe_{1y,3y,5y}, sortino_{1y,3y,5y}, alpha_{1y,3y}, beta_{1y,3y},
  tracking_error_{1y,3y}, info_ratio_{1y,3y}, treynor_{1y,3y}, max_drawdown_{1y,3y}

Formulas (monthly return sampling):
  sharpe   = (Rp - Rf) / σp
  sortino  = (Rp - Rf) / σp_downside
  alpha    = Rp - [Rf + β(Rm - Rf)]              (Jensen's)
  beta     = cov(Rp, Rm) / var(Rm)
  te       = σ(Rp - Rm)
  info     = mean(Rp - Rm) / te
  treynor  = (Rp - Rf) / β
  max_dd   = min((NAVt - peakt) / peakt)
"""
from __future__ import annotations

import logging

from ..core.logger import IngestionLogger

log = logging.getLogger(__name__)

SOURCE = "compute"
JOB = "risk_ratios"


def run() -> int:
    with IngestionLogger(source=SOURCE, job_name=JOB) as logger:
        # TODO(DATA-005/006): load nav+benchmark+rf → numpy, compute matrix,
        # batch UPDATE fund_returns. Stubbed for scaffold.
        written = 0
        logger.set_row_count(written)
        logger.mark_partial()
        logger.meta({"note": "stub; see DATA-005 and DATA-006"})
        return written


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(f"wrote {run()} rows")
