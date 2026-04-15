"""benchmark_tri — Total Return Index ingestion for scheme benchmarks.

Source:   niftyindices.com TRI CSV downloads (per index)
Target:   benchmark_data (existing table from migration 004)
Purpose:  input for compute/risk_ratios.py (alpha, beta, tracking error)

Indices covered (via scheme_benchmark_map.benchmark_name):
  NIFTY_50_TRI, NIFTY_MIDCAP_150_TRI, NIFTY_SMALLCAP_250_TRI,
  CRISIL_COMPOSITE_BOND, NIFTY_BANK_TRI, ...

Stub for now — actual CSV layout is per-index and needs a confirmed
mapping file. Tracked under DATA-004.
"""
from __future__ import annotations

import logging

from ..core.db import execute_batch, fetch_all
from ..core.logger import IngestionLogger

log = logging.getLogger(__name__)

SOURCE = "nse_tri"
JOB = "tri_daily"

_UPSERT_SQL = """
    INSERT INTO benchmark_data (benchmark_name, date, value)
    VALUES %s
    ON CONFLICT (benchmark_name, date)
    DO UPDATE SET value = EXCLUDED.value;
"""


def distinct_benchmarks() -> list[str]:
    rows = fetch_all("SELECT DISTINCT benchmark_name FROM scheme_benchmark_map;")
    return [r["benchmark_name"] for r in rows]


def fetch_rows() -> list[tuple]:
    """Daily benchmark ingestion.

    Current reality: benchmark_data is populated by (a) the existing
    /api/cron/market-update route and (b) the yahoo_nifty_history adapter
    (Path A backfill, price-close proxy, NOT TRI). This adapter is a NOOP
    until we swap in the NSE TRI CSV source (DATA-004 extension — pending).

    Returning empty list + marking partial is the right signal: pipeline
    reports 'no new rows' without masking the fact that real TRI data is
    not yet ingested here.
    """
    benchmarks = distinct_benchmarks()
    log.info("benchmark_tri NOOP — market-update cron owns ingestion for %d mapped benchmarks", len(benchmarks))
    return []


def run() -> int:
    with IngestionLogger(source=SOURCE, job_name=JOB) as logger:
        rows = fetch_rows()
        written = execute_batch(_UPSERT_SQL, rows)
        logger.set_row_count(written)
        if not rows:
            logger.mark_partial()
            logger.meta({"note": "stub; see DATA-004"})
        return written


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(f"wrote {run()} rows")
