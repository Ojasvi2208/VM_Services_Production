"""total_return — reconstruct dividend-adjusted NAV series for IDCW plans.

For growth plans: tr_nav = nav_value (pass-through, no-op).
For IDCW plans:
  - On dividend record_date, investor receives D per unit.
  - Equivalent buy-and-reinvest return requires scaling NAVs by the
    cumulative factor ∏ (1 + D_i / NAV_on_record_date_i).
  - Walk nav_history forward from inception, applying factor on each
    record_date from scheme_dividend.

Target: nav_history.tr_nav (added in migration 026).
"""
from __future__ import annotations

import logging

from ..core.logger import IngestionLogger

log = logging.getLogger(__name__)

SOURCE = "compute"
JOB = "total_return"


def run() -> int:
    with IngestionLogger(source=SOURCE, job_name=JOB) as logger:
        # TODO(DATA-002): two-phase update:
        #   1) growth plans: UPDATE nav_history SET tr_nav = nav_value
        #      WHERE scheme_code IN (SELECT scheme_code FROM funds WHERE option_type='Growth');
        #   2) IDCW plans: per-scheme forward walk with cumulative factor.
        written = 0
        logger.set_row_count(written)
        logger.mark_partial()
        logger.meta({"note": "stub; see DATA-002"})
        return written


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(f"wrote {run()} rows")
