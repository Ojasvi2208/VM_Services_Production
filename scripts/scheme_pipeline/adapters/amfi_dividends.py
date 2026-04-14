"""amfi_dividends — IDCW dividend history ingestion.

Source:   AMFI R&A dividend history report (HTML table → parsed rows)
Target:   scheme_dividend (ON CONFLICT scheme_code, record_date DO NOTHING)
Purpose:  input for compute/total_return.py (tr_nav reconstruction)

NOTE: Initial scaffolding — the AMFI R&A report requires a multi-step
form POST. Real implementation lives in a follow-up once the HTML
schema is confirmed against a sample download.
"""
from __future__ import annotations

import logging

from ..core.db import execute_batch
from ..core.logger import IngestionLogger

log = logging.getLogger(__name__)

SOURCE = "amfi_dividends"
JOB = "dividends_monthly"

_UPSERT_SQL = """
    INSERT INTO scheme_dividend
        (scheme_code, record_date, ex_date, dividend_per_unit, nav_on_record_date, source)
    VALUES %s
    ON CONFLICT (scheme_code, record_date) DO NOTHING;
"""


def fetch_rows() -> list[tuple]:
    """Return list of (scheme_code, record_date, ex_date, div_per_unit, nav_on_record, source).

    TODO(DATA-002): wire to AMFI R&A history report once form flow is mapped.
    Stubbed to return no rows so the pipeline runs green in non-prod.
    """
    log.warning("amfi_dividends.fetch_rows is a stub — returns 0 rows until DATA-002 is implemented")
    return []


def run() -> int:
    with IngestionLogger(source=SOURCE, job_name=JOB) as logger:
        rows = fetch_rows()
        written = execute_batch(_UPSERT_SQL, rows)
        logger.set_row_count(written)
        if not rows:
            logger.mark_partial()
            logger.meta({"note": "stub implementation; see DATA-002"})
        return written


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(f"wrote {run()} rows")
