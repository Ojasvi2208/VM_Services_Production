"""daily_etl — orchestrates the full nightly pipeline.

Order matters:
  1. adapters (raw data in)       — amfi_nav, amfi_dividends, benchmark_tri
  2. compute/total_return         — fills tr_nav (depends on dividends)
  3. compute/rolling_returns      — consumes tr_nav
  4. compute/risk_ratios          — consumes rolling_returns + benchmark
  5. compute/percentile           — consumes rolling_returns + ratios

Each step runs even if the previous reported 'partial'. Only an uncaught
exception aborts the run. The per-step ingestion_run row is the truth of
what happened; this orchestrator never double-logs.

Usage:
    python -m scheme_pipeline.jobs.daily_etl
    python -m scheme_pipeline.jobs.daily_etl --only nav,percentile
    python -m scheme_pipeline.jobs.daily_etl --skip benchmark_tri
"""
from __future__ import annotations

import argparse
import logging
import sys
from typing import Callable

from ..adapters import amfi_dividends, amfi_nav, benchmark_tri
from ..compute import percentile, risk_ratios, rolling_returns, total_return
from ..core.db import close_pool

log = logging.getLogger(__name__)

# Registry: name -> run(). Ordered. One source of truth used by CLI args.
STEPS: list[tuple[str, Callable[[], int]]] = [
    ("amfi_nav", amfi_nav.run),
    ("amfi_dividends", amfi_dividends.run),
    ("benchmark_tri", benchmark_tri.run),
    ("total_return", total_return.run),
    ("rolling_returns", rolling_returns.run),
    ("risk_ratios", risk_ratios.run),
    ("percentile", percentile.run),
]


def _filter(only: set[str] | None, skip: set[str] | None) -> list[tuple[str, Callable[[], int]]]:
    steps = STEPS
    if only:
        steps = [s for s in steps if s[0] in only]
    if skip:
        steps = [s for s in steps if s[0] not in skip]
    return steps


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the scheme_master_pipeline nightly ETL.")
    parser.add_argument("--only", help="Comma-sep step names to include", default="")
    parser.add_argument("--skip", help="Comma-sep step names to exclude", default="")
    args = parser.parse_args(argv)

    only = {s.strip() for s in args.only.split(",") if s.strip()} or None
    skip = {s.strip() for s in args.skip.split(",") if s.strip()} or None
    plan = _filter(only, skip)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    log.info("daily_etl plan: %s", [name for name, _ in plan])

    failed: list[str] = []
    try:
        for name, fn in plan:
            try:
                fn()
            except Exception:
                log.exception("[%s] step crashed — continuing to next step", name)
                failed.append(name)
    finally:
        close_pool()

    if failed:
        log.error("daily_etl done with failures: %s", failed)
        return 1
    log.info("daily_etl done cleanly")
    return 0


if __name__ == "__main__":
    sys.exit(main())
