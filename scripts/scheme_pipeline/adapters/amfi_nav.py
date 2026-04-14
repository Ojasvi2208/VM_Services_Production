"""amfi_nav — daily NAV ingestion from AMFI NAVAll.txt.

Source:   https://portal.amfiindia.com/spages/NAVAll.txt
Target:   nav_history (ON CONFLICT scheme_code, nav_date DO UPDATE)
Cadence:  daily @ 21:30 IST (scheduled by GitHub Actions / Vercel Cron)

Format is a pipe-delimited text file with AMC-grouped sections. We parse
line-by-line rather than pulling into memory as a single blob.
"""
from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Iterator

import requests

from ..core.config import settings
from ..core.db import execute_batch
from ..core.logger import IngestionLogger

log = logging.getLogger(__name__)

SOURCE = "amfi_nav"
JOB = "nav_daily"

_UPSERT_SQL = """
    INSERT INTO nav_history (scheme_code, nav_date, nav_value)
    VALUES %s
    ON CONFLICT (scheme_code, nav_date)
    DO UPDATE SET nav_value = EXCLUDED.nav_value;
"""


def _parse_line(line: str) -> tuple[str, date, float] | None:
    """Parse one NAVAll.txt row. Returns None for headers / blank / malformed rows."""
    parts = [p.strip() for p in line.split(";")]
    if len(parts) < 6:
        return None
    scheme_code, _isin_div, _isin_gr, _name, nav_str, date_str = parts[:6]
    if not scheme_code.isdigit():
        return None
    try:
        nav = float(nav_str)
        nav_date = datetime.strptime(date_str, "%d-%b-%Y").date()
    except (ValueError, TypeError):
        return None
    return scheme_code, nav_date, nav


def _fetch_rows() -> Iterator[tuple[str, date, float]]:
    if settings is None:
        raise RuntimeError("settings not loaded — check DATABASE_URL")
    resp = requests.get(settings.amfi_nav_url, timeout=60)
    resp.raise_for_status()
    for line in resp.text.splitlines():
        parsed = _parse_line(line)
        if parsed is not None:
            yield parsed


def run() -> int:
    with IngestionLogger(source=SOURCE, job_name=JOB) as logger:
        rows = list(_fetch_rows())
        written = execute_batch(_UPSERT_SQL, rows)
        logger.set_row_count(written)
        logger.meta({"fetched_rows": len(rows)})
        return written


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    print(f"wrote {run()} rows")
