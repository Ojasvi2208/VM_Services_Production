"""yahoo_nifty_history — historical daily close for NIFTY 50 / NIFTY BANK.

Source:   Yahoo Finance chart API via Cloudflare relay
          (query1.finance.yahoo.com/v8/finance/chart/<symbol>)
Target:   benchmark_data (benchmark_name, date, value)
Cadence:  nightly, watermark-aware

PROXY WARNING
-------------
Yahoo publishes PRICE CLOSE, not Total Return. NIFTY 50 dividend yield
(~1.3% p.a.) and NIFTY Bank (~0.8% p.a.) are NOT included. Alpha/IR
computed against this series will read systematically high. This is a
short-term proxy until DATA-004 lands real CRISIL/NSE TRI. Provenance
is stamped into ingestion_run.metadata so downstream (DATA-005) can
badge ratios as "proxy".

Watermark logic:
  - If max(date) for a benchmark is < today - 30d  → range=5y (backfill)
  - Else                                           → range=1mo (gap-fill)

Reuses existing benchmark_name tokens (NIFTY50, NIFTYBANK) that the
/api/cron/market-update route already writes, so UPSERT merges cleanly.
"""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from urllib.parse import quote

import requests

from ..core.db import execute_batch, fetch_one
from ..core.logger import IngestionLogger

log = logging.getLogger(__name__)

SOURCE = "yahoo_nifty_history"
JOB = "nifty_history_daily"

CF_RELAY_URL = os.environ.get(
    "CF_RELAY_URL",
    "https://bse-nse-relay.vmfinancialservices.workers.dev",
).rstrip("/")

# Yahoo symbol -> benchmark_name in our DB. Keep names aligned with
# /api/cron/market-update so rows merge.
SYMBOLS: list[tuple[str, str]] = [
    ("^NSEI", "NIFTY50"),
    ("^NSEBANK", "NIFTYBANK"),
]

BACKFILL_TRIGGER_DAYS = 30   # if latest row older than this → full backfill
BACKFILL_RANGE = "5y"
INCREMENTAL_RANGE = "1mo"
REQUEST_TIMEOUT = 30         # seconds

_UPSERT_SQL = """
    INSERT INTO benchmark_data (benchmark_name, date, value)
    VALUES %s
    ON CONFLICT (benchmark_name, date)
    DO UPDATE SET value = EXCLUDED.value;
"""


def _latest_date(benchmark_name: str) -> Optional[date]:
    row = fetch_one(
        "SELECT MAX(date) AS d FROM benchmark_data WHERE benchmark_name = %s;",
        (benchmark_name,),
    )
    return row["d"] if row and row.get("d") else None


def _choose_range(latest: Optional[date]) -> str:
    if latest is None:
        return BACKFILL_RANGE
    if (date.today() - latest).days > BACKFILL_TRIGGER_DAYS:
        return BACKFILL_RANGE
    return INCREMENTAL_RANGE


def _fetch_chart(symbol: str, rng: str) -> dict:
    chart_url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(symbol, safe='')}"
        f"?range={rng}&interval=1d"
    )
    proxy_url = f"{CF_RELAY_URL}/?url={quote(chart_url, safe='')}"
    resp = requests.get(proxy_url, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def _parse_chart(payload: dict) -> list[tuple[date, float]]:
    result = (payload.get("chart") or {}).get("result") or []
    if not result:
        return []
    node = result[0]
    timestamps = node.get("timestamp") or []
    closes = (
        ((node.get("indicators") or {}).get("quote") or [{}])[0].get("close") or []
    )
    out: list[tuple[date, float]] = []
    for ts, close in zip(timestamps, closes):
        if ts is None or close is None:
            continue
        # Yahoo timestamps are unix seconds (UTC). Market close ~10:00 UTC;
        # UTC day = IST day for that close.
        d = datetime.fromtimestamp(int(ts), tz=timezone.utc).date()
        try:
            out.append((d, float(close)))
        except (TypeError, ValueError):
            continue
    return out


def _ingest_one(symbol: str, benchmark_name: str) -> tuple[int, dict]:
    latest = _latest_date(benchmark_name)
    rng = _choose_range(latest)
    payload = _fetch_chart(symbol, rng)
    points = _parse_chart(payload)
    if not points:
        return 0, {
            "symbol": symbol,
            "range": rng,
            "latest_existing": latest.isoformat() if latest else None,
            "fetched_rows": 0,
            "note": "yahoo returned empty series",
        }
    rows = [(benchmark_name, d, v) for d, v in points]
    written = execute_batch(_UPSERT_SQL, rows)
    return written, {
        "symbol": symbol,
        "range": rng,
        "latest_existing": latest.isoformat() if latest else None,
        "fetched_rows": len(rows),
        "written_rows": written,
        "first_date": rows[0][1].isoformat(),
        "last_date": rows[-1][1].isoformat(),
    }


def run() -> int:
    with IngestionLogger(source=SOURCE, job_name=JOB) as logger:
        total = 0
        per_symbol: list[dict] = []
        failures: list[str] = []
        for symbol, benchmark_name in SYMBOLS:
            try:
                written, info = _ingest_one(symbol, benchmark_name)
                total += written
                per_symbol.append({"benchmark": benchmark_name, **info})
                log.info(
                    "[yahoo_nifty_history] %s (%s) wrote %d rows",
                    benchmark_name, symbol, written,
                )
            except Exception as exc:
                log.exception("[yahoo_nifty_history] %s failed", symbol)
                failures.append(benchmark_name)
                per_symbol.append({"benchmark": benchmark_name, "error": str(exc)[:500]})
        logger.set_row_count(total)
        logger.meta({
            "source": "yahoo_price_proxy",
            "note": "NOT TRI — dividends excluded; short-term proxy for DATA-005 risk ratios",
            "symbols": per_symbol,
            "failures": failures,
        })
        if failures and total == 0:
            # Everything failed — let IngestionLogger mark it failed via exception
            raise RuntimeError(f"yahoo_nifty_history: all symbols failed: {failures}")
        if failures:
            logger.mark_partial()
        return total


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    print(f"wrote {run()} rows")
