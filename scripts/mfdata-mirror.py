"""
mfdata-mirror.py — MFD-002
==========================
Mirror mfdata.in data to our Postgres. Rate-limited, checkpointed, idempotent.

Usage:
  python3 scripts/mfdata-mirror.py --mode initial-full           # one-time bulk mirror (~36h)
  python3 scripts/mfdata-mirror.py --mode daily-metadata         # daily scheme refresh
  python3 scripts/mfdata-mirror.py --mode weekly-ratios          # weekly ratios refresh
  python3 scripts/mfdata-mirror.py --mode monthly-holdings       # monthly family holdings
  python3 scripts/mfdata-mirror.py --mode scheme --code 122640   # single scheme
  python3 scripts/mfdata-mirror.py --mode health                 # probe mfdata.in /stats

Flags:
  --dry-run             No DB writes
  --sample N            Process first N items only
  --reset-checkpoint    Clear checkpoint and start over

Rate limits (mfdata.in):
  - 120 req/min per IP (we use max 100/min)
  - 10,000 req/day per IP (we abort at 500 remaining)
  - cache-control: public, max-age=300 — respect 5min freshness

Architecture:
  - Reads from https://mfdata.in/api/v1/*
  - Writes to Railway Postgres via psycopg2
  - Checkpoints to DB table mfdata_sync_log + file /tmp/mfdata_checkpoint_<mode>.json
  - All UPSERTs — re-running never corrupts
  - Every row has source='mfdata' + fetched_at timestamp
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import psycopg2
import psycopg2.extras
import requests

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway",
)
MFDATA_BASE = os.environ.get("MFDATA_BASE", "https://mfdata.in")
CHECKPOINT_DIR = Path(os.environ.get("MFDATA_CHECKPOINT_DIR", "/tmp"))
USER_AGENT = "Akshaya-MFDataMirror/1.0 (+https://vmfinancialservices.com; contact@vmfinancialservices.com)"

# Rate limiting: leave margin below mfdata.in's 120/min and 10k/day
MAX_REQ_PER_MIN = 100
MIN_REMAINING_DAILY_BEFORE_ABORT = 500

# HTTP retry config
MAX_RETRIES = 3
BACKOFF_BASE_SECONDS = 2


class RateLimitClient:
    """Rate-limited HTTP client for mfdata.in with checkpoint-safe counters."""

    def __init__(self, base_url: str = MFDATA_BASE):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        })
        self._req_timestamps: list[float] = []  # last 60s of request times
        self._last_remaining_daily: Optional[int] = None
        self.total_calls = 0

    def _respect_rate_limit(self) -> None:
        """Sleep if we're about to exceed MAX_REQ_PER_MIN."""
        now = time.time()
        # Drop timestamps older than 60s
        self._req_timestamps = [t for t in self._req_timestamps if now - t < 60]
        if len(self._req_timestamps) >= MAX_REQ_PER_MIN:
            sleep_for = 60 - (now - self._req_timestamps[0]) + 0.1
            if sleep_for > 0:
                time.sleep(sleep_for)

    def get(self, path: str, params: Optional[dict] = None) -> Optional[dict]:
        """GET with rate limit + retry. Returns dict or None on unrecoverable error."""
        url = f"{self.base_url}{path}"
        for attempt in range(MAX_RETRIES):
            self._respect_rate_limit()
            try:
                resp = self.session.get(url, params=params, timeout=30)
                self._req_timestamps.append(time.time())
                self.total_calls += 1

                # Track daily remaining
                remaining = resp.headers.get("x-ratelimit-daily-remaining")
                if remaining is not None:
                    try:
                        self._last_remaining_daily = int(remaining)
                    except ValueError:
                        pass

                if resp.status_code == 200:
                    return resp.json()
                if resp.status_code == 404:
                    return None
                if resp.status_code == 429:
                    reset = int(resp.headers.get("x-ratelimit-reset", "0"))
                    wait = max(reset - int(time.time()), 30) if reset else 30 * (2 ** attempt)
                    print(f"    [429] rate-limited, sleeping {wait}s...", flush=True)
                    time.sleep(wait)
                    continue
                if 500 <= resp.status_code < 600:
                    wait = BACKOFF_BASE_SECONDS ** (attempt + 1)
                    print(f"    [{resp.status_code}] server error, backoff {wait}s...", flush=True)
                    time.sleep(wait)
                    continue
                # Other 4xx: log + give up
                print(f"    [{resp.status_code}] {url} — skipping", flush=True)
                return None
            except requests.RequestException as e:
                wait = BACKOFF_BASE_SECONDS ** (attempt + 1)
                print(f"    network error ({e}), backoff {wait}s...", flush=True)
                time.sleep(wait)
        return None

    def should_abort_daily(self) -> bool:
        """Return True if daily quota nearly exhausted — caller must stop."""
        if self._last_remaining_daily is None:
            return False
        return self._last_remaining_daily < MIN_REMAINING_DAILY_BEFORE_ABORT

    def remaining_daily(self) -> Optional[int]:
        return self._last_remaining_daily


# ───────────────────────────────────────────────────────────────
# DB helpers
# ───────────────────────────────────────────────────────────────

def db_connect() -> psycopg2.extensions.connection:
    conn = psycopg2.connect(DB_URL, connect_timeout=30)
    conn.autocommit = False
    return conn


def start_sync_log(conn, mode: str, notes: str = "") -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO mfdata_sync_log (mode, status, notes) VALUES (%s, 'running', %s) RETURNING id",
            (mode, notes),
        )
        sync_id = cur.fetchone()[0]
    conn.commit()
    return sync_id


def finish_sync_log(conn, sync_id: int, *, status: str, api_calls: int,
                    rows_written: int, schemes_updated: int, families_updated: int,
                    error_message: Optional[str] = None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE mfdata_sync_log
               SET finished_at = NOW(), status = %s,
                   api_calls_made = %s, rows_written = %s,
                   schemes_updated = %s, families_updated = %s,
                   error_message = %s
               WHERE id = %s""",
            (status, api_calls, rows_written, schemes_updated, families_updated,
             error_message, sync_id),
        )
    conn.commit()


def load_checkpoint(mode: str) -> dict:
    cp_file = CHECKPOINT_DIR / f"mfdata_checkpoint_{mode}.json"
    if cp_file.exists():
        try:
            return json.loads(cp_file.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {
        "completed_schemes": [],
        "completed_families": [],
        "last_stage": None,
        "last_run": None,
    }


def save_checkpoint(mode: str, cp: dict) -> None:
    cp["last_run"] = datetime.now(timezone.utc).isoformat()
    cp_file = CHECKPOINT_DIR / f"mfdata_checkpoint_{mode}.json"
    cp_file.write_text(json.dumps(cp, indent=2))


# ───────────────────────────────────────────────────────────────
# Upsert helpers — one per target table
# ───────────────────────────────────────────────────────────────

def upsert_fund_family(conn, family: dict) -> None:
    """Upsert into fund_families."""
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO fund_families (
                   family_id, family_name, amc_slug, amc_name, category, sub_category,
                   benchmark_name, has_holdings, has_ratios, has_risk_detail,
                   latest_holdings_month, source, fetched_at, updated_at)
               VALUES (%(family_id)s, %(family_name)s, %(amc_slug)s, %(amc_name)s,
                       %(category)s, %(sub_category)s, %(benchmark_name)s,
                       %(has_holdings)s, %(has_ratios)s, %(has_risk_detail)s,
                       %(latest_holdings_month)s, 'mfdata', NOW(), NOW())
               ON CONFLICT (family_id) DO UPDATE SET
                   family_name = EXCLUDED.family_name,
                   amc_slug = EXCLUDED.amc_slug,
                   amc_name = EXCLUDED.amc_name,
                   category = EXCLUDED.category,
                   sub_category = EXCLUDED.sub_category,
                   benchmark_name = EXCLUDED.benchmark_name,
                   has_holdings = EXCLUDED.has_holdings,
                   has_ratios = EXCLUDED.has_ratios,
                   has_risk_detail = EXCLUDED.has_risk_detail,
                   latest_holdings_month = EXCLUDED.latest_holdings_month,
                   fetched_at = NOW(),
                   updated_at = NOW()""",
            family,
        )


def upsert_scheme_enrichment(conn, data: dict) -> int:
    """Apply enriched scheme data to funds table. Returns 1 if row updated, 0 otherwise."""
    scheme_code = str(data.get("amfi_code", "")).strip()
    if not scheme_code:
        return 0
    payload = {
        "scheme_code":         scheme_code,
        "min_lumpsum":         data.get("min_lumpsum"),
        "min_sip":             data.get("min_sip"),
        "min_additional":      data.get("min_additional"),
        "morningstar_rating":  data.get("morningstar"),
        "morningstar_sec_id":  data.get("morningstar_sec_id"),
        "risk_label":          data.get("risk_label"),
        "benchmark_name":      data.get("benchmark"),
        "day_change_pct":      data.get("day_change_pct"),
        "mfdata_family_id":    data.get("family_id"),
        "mfdata_amfi_code":    scheme_code,
        "mfdata_isin":         data.get("isin"),
        "expense_ratio":       data.get("expense_ratio"),
        "fund_size":           (float(data["aum"]) / 10_000_000.0) if data.get("aum") else None,
        "exit_load":           data.get("exit_load"),
        "latest_nav":          data.get("nav"),
        "latest_nav_date":     data.get("nav_date"),
    }
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE funds SET
                   min_lumpsum          = COALESCE(%(min_lumpsum)s, funds.min_lumpsum),
                   min_sip              = COALESCE(%(min_sip)s, funds.min_sip),
                   min_additional       = COALESCE(%(min_additional)s, funds.min_additional),
                   morningstar_rating   = COALESCE(%(morningstar_rating)s, funds.morningstar_rating),
                   morningstar_sec_id   = COALESCE(%(morningstar_sec_id)s, funds.morningstar_sec_id),
                   risk_label           = COALESCE(%(risk_label)s, funds.risk_label),
                   benchmark_name       = COALESCE(%(benchmark_name)s, funds.benchmark_name),
                   day_change_pct       = %(day_change_pct)s,
                   mfdata_family_id     = %(mfdata_family_id)s,
                   mfdata_amfi_code     = %(mfdata_amfi_code)s,
                   mfdata_isin          = COALESCE(%(mfdata_isin)s, funds.mfdata_isin),
                   expense_ratio        = COALESCE(%(expense_ratio)s, funds.expense_ratio),
                   fund_size            = COALESCE(%(fund_size)s, funds.fund_size),
                   exit_load            = COALESCE(%(exit_load)s, funds.exit_load),
                   latest_nav           = COALESCE(%(latest_nav)s, funds.latest_nav),
                   latest_nav_date      = COALESCE(%(latest_nav_date)s::date, funds.latest_nav_date),
                   mfdata_last_synced_at = NOW(),
                   updated_at           = NOW()
               WHERE scheme_code = %(scheme_code)s""",
            payload,
        )
        return cur.rowcount


def upsert_scheme_ratios(conn, scheme_code: str, ratios: dict, returns: dict) -> int:
    """Apply ratios + returns to fund_returns table."""
    if not ratios and not returns:
        return 0
    val = ratios.get("valuation") or {}
    eff = ratios.get("efficiency") or {}
    ret = ratios.get("returns") or {}
    risk = ratios.get("risk") or {}

    # mfdata.in returns ratios trailing 3Y by default; we write to *_3y columns.
    # Actual fund_returns schema: sharpe_ratio_1y (3y unavailable), sortino_3y, alpha_3y, beta_3y, std_dev_1y
    payload = {
        "scheme_code":       scheme_code,
        "return_1m":         returns.get("return_1m"),
        "return_3m":         returns.get("return_3m"),
        "return_6m":         returns.get("return_6m"),
        "return_1y":         returns.get("return_1y"),
        "return_3y":         returns.get("return_3y"),
        "return_5y":         returns.get("return_5y"),
        "rank_1m":           returns.get("rank_1m"),
        "rank_3m":           returns.get("rank_3m"),
        "rank_6m":           returns.get("rank_6m"),
        "rank_1y":           returns.get("rank_1y"),
        "rank_3y":           returns.get("rank_3y"),
        "rank_5y":           returns.get("rank_5y"),
        "rank_total":        returns.get("rank_total"),
        "sharpe_ratio_1y":   ret.get("sharpe_ratio"),
        "jensens_alpha":     ret.get("jensens_alpha"),
        "treynor_ratio":     ret.get("treynor_ratio"),
        "information_ratio": ret.get("information_ratio"),
        "std_dev_1y":        risk.get("std_deviation"),
        "beta_3y":           risk.get("beta"),
        "alpha_3y":          ret.get("jensens_alpha"),  # alias — mfdata provides Jensen's alpha
        "sortino_3y":        risk.get("sortino_ratio"),
        "r_squared":         risk.get("r_squared"),
    }
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO fund_returns (scheme_code, return_1m, return_3m, return_6m,
                   return_1y, return_3y, return_5y,
                   rank_1m, rank_3m, rank_6m, rank_1y, rank_3y, rank_5y, rank_total,
                   sharpe_ratio_1y, jensens_alpha, treynor_ratio, information_ratio,
                   std_dev_1y, beta_3y, alpha_3y, sortino_3y, r_squared, updated_at)
               VALUES (%(scheme_code)s, %(return_1m)s, %(return_3m)s, %(return_6m)s,
                   %(return_1y)s, %(return_3y)s, %(return_5y)s,
                   %(rank_1m)s, %(rank_3m)s, %(rank_6m)s, %(rank_1y)s, %(rank_3y)s,
                   %(rank_5y)s, %(rank_total)s,
                   %(sharpe_ratio_1y)s, %(jensens_alpha)s, %(treynor_ratio)s, %(information_ratio)s,
                   %(std_dev_1y)s, %(beta_3y)s, %(alpha_3y)s, %(sortino_3y)s, %(r_squared)s, NOW())
               ON CONFLICT (scheme_code) DO UPDATE SET
                   return_1m = COALESCE(EXCLUDED.return_1m, fund_returns.return_1m),
                   return_3m = COALESCE(EXCLUDED.return_3m, fund_returns.return_3m),
                   return_6m = COALESCE(EXCLUDED.return_6m, fund_returns.return_6m),
                   return_1y = COALESCE(EXCLUDED.return_1y, fund_returns.return_1y),
                   return_3y = COALESCE(EXCLUDED.return_3y, fund_returns.return_3y),
                   return_5y = COALESCE(EXCLUDED.return_5y, fund_returns.return_5y),
                   rank_1m = EXCLUDED.rank_1m, rank_3m = EXCLUDED.rank_3m,
                   rank_6m = EXCLUDED.rank_6m, rank_1y = EXCLUDED.rank_1y,
                   rank_3y = EXCLUDED.rank_3y, rank_5y = EXCLUDED.rank_5y,
                   rank_total = EXCLUDED.rank_total,
                   sharpe_ratio_1y = COALESCE(EXCLUDED.sharpe_ratio_1y, fund_returns.sharpe_ratio_1y),
                   jensens_alpha = COALESCE(EXCLUDED.jensens_alpha, fund_returns.jensens_alpha),
                   treynor_ratio = COALESCE(EXCLUDED.treynor_ratio, fund_returns.treynor_ratio),
                   information_ratio = COALESCE(EXCLUDED.information_ratio, fund_returns.information_ratio),
                   std_dev_1y = COALESCE(EXCLUDED.std_dev_1y, fund_returns.std_dev_1y),
                   beta_3y = COALESCE(EXCLUDED.beta_3y, fund_returns.beta_3y),
                   alpha_3y = COALESCE(EXCLUDED.alpha_3y, fund_returns.alpha_3y),
                   sortino_3y = COALESCE(EXCLUDED.sortino_3y, fund_returns.sortino_3y),
                   r_squared = COALESCE(EXCLUDED.r_squared, fund_returns.r_squared),
                   updated_at = NOW()""",
            payload,
        )
        return cur.rowcount


def upsert_fundamentals(conn, scheme_code: str, ratios: dict) -> int:
    """Upsert valuation/efficiency/income fundamentals into fund_fundamentals."""
    if not ratios:
        return 0
    val = ratios.get("valuation") or {}
    eff = ratios.get("efficiency") or {}
    payload = {
        "scheme_code":    scheme_code,
        "pe_ratio":       val.get("pe_ratio"),
        "pb_ratio":       val.get("pb_ratio"),
        "ps_ratio":       val.get("ps_ratio"),
        "dividend_yield": val.get("dividend_yield"),
        "roe":            eff.get("roe"),
        "roa":            eff.get("roa"),
        "as_of_date":     ratios.get("as_of_date"),
    }
    # skip if all null
    if all(payload[k] is None for k in ["pe_ratio","pb_ratio","ps_ratio","dividend_yield","roe","roa"]):
        return 0
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO fund_fundamentals (scheme_code, pe_ratio, pb_ratio, ps_ratio,
                   dividend_yield, roe, roa, as_of_date, source, fetched_at, updated_at)
               VALUES (%(scheme_code)s, %(pe_ratio)s, %(pb_ratio)s, %(ps_ratio)s,
                   %(dividend_yield)s, %(roe)s, %(roa)s, %(as_of_date)s::date,
                   'mfdata', NOW(), NOW())
               ON CONFLICT (scheme_code) DO UPDATE SET
                   pe_ratio = EXCLUDED.pe_ratio,
                   pb_ratio = EXCLUDED.pb_ratio,
                   ps_ratio = EXCLUDED.ps_ratio,
                   dividend_yield = EXCLUDED.dividend_yield,
                   roe = EXCLUDED.roe,
                   roa = EXCLUDED.roa,
                   as_of_date = EXCLUDED.as_of_date,
                   fetched_at = NOW(),
                   updated_at = NOW()""",
            payload,
        )
        return cur.rowcount


def upsert_category_averages(conn, category: str, ratios: dict) -> int:
    """Extract category_averages from ratios block and upsert into category_benchmarks."""
    if not ratios or not category:
        return 0
    cavg = ratios.get("category_averages") or {}
    rows = [
        (category, metric, "current", float(value), datetime.now().date())
        for metric, value in cavg.items() if value is not None
    ]
    if not rows:
        return 0
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur,
            """INSERT INTO category_benchmarks (category, metric, period, value, as_of_date, source, fetched_at)
               VALUES %s
               ON CONFLICT (category, metric, period, as_of_date) DO UPDATE SET
                   value = EXCLUDED.value,
                   fetched_at = NOW()""",
            [(c, m, p, v, d, "mfdata", datetime.now()) for (c, m, p, v, d) in rows],
            template="(%s, %s, %s, %s, %s, %s, %s)",
        )
        return len(rows)


# ───────────────────────────────────────────────────────────────
# Modes
# ───────────────────────────────────────────────────────────────

def mode_health(client: RateLimitClient) -> None:
    """Probe mfdata.in /stats — quick health check."""
    stats = client.get("/api/v1/stats")
    if stats:
        print(json.dumps(stats, indent=2))
    else:
        print("health check FAILED")


def mode_scheme(conn, client: RateLimitClient, scheme_code: str, dry_run: bool) -> dict:
    """Enrich a single scheme_code. Called standalone or from bulk loops.

    Error isolation: entire per-scheme operation wrapped in try/except with rollback on failure,
    so one malformed scheme doesn't poison the connection for the rest of the batch.
    """
    stats = {"updated": 0, "calls": 0, "fundamentals": 0, "ratios": 0, "error": None}

    # /schemes/{code} returns nested data + ratios + returns in one call
    payload = client.get(f"/api/v1/schemes/{scheme_code}")
    stats["calls"] = client.total_calls
    if not payload or payload.get("status") != "success":
        return stats
    data = payload.get("data") or {}
    if not data:
        return stats

    if dry_run:
        stats["updated"] = 1
        return stats

    try:
        # 1. Upsert family
        if data.get("family_id"):
            fam_payload = {
                "family_id":            data["family_id"],
                "family_name":          data.get("family_name"),
                "amc_slug":             data.get("amc_slug"),
                "amc_name":             data.get("amc_name"),
                "category":             data.get("category"),
                "sub_category":         None,
                "benchmark_name":       data.get("benchmark"),
                "has_holdings":         False,
                "has_ratios":           bool(data.get("ratios")),
                "has_risk_detail":      False,
                "latest_holdings_month": None,
            }
            upsert_fund_family(conn, fam_payload)

        # 2. Enrich funds row
        rc = upsert_scheme_enrichment(conn, data)
        stats["updated"] = rc

        # 3. Ratios + returns
        ratios = data.get("ratios") or {}
        returns = data.get("returns") or {}
        if ratios or returns:
            stats["ratios"] = upsert_scheme_ratios(conn, scheme_code, ratios, returns)

        # 4. Fundamentals
        if ratios:
            stats["fundamentals"] = upsert_fundamentals(conn, scheme_code, ratios)

        # 5. Category averages
        category = data.get("category")
        if category and ratios:
            upsert_category_averages(conn, category, ratios)

        conn.commit()
    except Exception as e:
        # Single scheme failure must not kill the batch.
        # Roll back this scheme's uncommitted work + clear aborted-transaction state.
        try:
            conn.rollback()
        except Exception:
            pass
        stats["error"] = f"{type(e).__name__}: {str(e)[:200]}"
        print(f"    [err {scheme_code}] {stats['error']}", flush=True)

    return stats


def mode_initial_full(conn, client: RateLimitClient, sample: int, dry_run: bool, reset_cp: bool) -> None:
    """One-time bulk mirror. Orchestrated multi-stage scrape."""
    mode = "initial-full"
    cp = load_checkpoint(mode) if not reset_cp else {
        "completed_schemes": [], "completed_families": [], "last_stage": None, "last_run": None,
    }
    print(f"[cp] starting: completed={len(cp['completed_schemes'])} schemes", flush=True)

    # Stage 1: pull scheme list from our DB (target = active direct growth first,
    # which is the UI-critical subset; widen in later stages)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT scheme_code FROM funds
            WHERE is_active = true
              AND scheme_name LIKE '%Direct%'
              AND scheme_name LIKE '%Growth%'
            ORDER BY scheme_code
        """)
        schemes = [r[0] for r in cur.fetchall()]
    if sample > 0:
        schemes = schemes[:sample]

    done_set = set(cp["completed_schemes"])
    remaining = [s for s in schemes if s not in done_set]
    print(f"[scope] {len(schemes)} total Direct Growth | {len(remaining)} remaining", flush=True)

    sync_id = start_sync_log(conn, mode, notes=f"scope=direct_growth total={len(schemes)}")
    total_updated = 0
    total_rat = 0
    total_fund = 0
    total_errors = 0

    try:
        for i, sc in enumerate(remaining, 1):
            if client.should_abort_daily():
                print(f"[abort] daily quota exhausted (remaining={client.remaining_daily()})", flush=True)
                break
            stats = mode_scheme(conn, client, sc, dry_run)
            total_updated += stats["updated"]
            total_rat += stats["ratios"]
            total_fund += stats["fundamentals"]
            if stats.get("error"):
                total_errors += 1

            if stats["updated"]:
                cp["completed_schemes"].append(sc)
            if i % 25 == 0:
                save_checkpoint(mode, cp)
                print(f"[progress] {i}/{len(remaining)} | updated={total_updated} "
                      f"ratios={total_rat} fundamentals={total_fund} errors={total_errors} "
                      f"daily_remaining={client.remaining_daily()}", flush=True)
            # Incremental sync_log update every 100 schemes for live visibility
            if i % 100 == 0:
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            """UPDATE mfdata_sync_log SET api_calls_made=%s, rows_written=%s,
                               schemes_updated=%s WHERE id=%s""",
                            (client.total_calls, total_updated + total_rat + total_fund,
                             total_updated, sync_id),
                        )
                    conn.commit()
                except Exception:
                    conn.rollback()

        save_checkpoint(mode, cp)
        finish_sync_log(
            conn, sync_id,
            status="success" if len(cp["completed_schemes"]) >= len(schemes) else "partial",
            api_calls=client.total_calls,
            rows_written=total_updated + total_rat + total_fund,
            schemes_updated=total_updated,
            families_updated=0,
        )
        print(f"[done] updated={total_updated} ratios={total_rat} "
              f"fundamentals={total_fund} api_calls={client.total_calls}", flush=True)
    except Exception as e:
        finish_sync_log(conn, sync_id, status="failed",
                        api_calls=client.total_calls, rows_written=total_updated + total_rat + total_fund,
                        schemes_updated=total_updated, families_updated=0,
                        error_message=str(e))
        raise


def mode_daily_metadata(conn, client: RateLimitClient, sample: int, dry_run: bool) -> None:
    """Daily refresh of active Direct Growth scheme metadata."""
    # Simplification: delegate to mode_initial_full — same scope, fresh fetch
    mode_initial_full(conn, client, sample=sample, dry_run=dry_run, reset_cp=True)


# ───────────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="Mirror mfdata.in to our Postgres")
    p.add_argument("--mode", required=True, choices=[
        "initial-full", "daily-metadata", "weekly-ratios", "monthly-holdings",
        "scheme", "health",
    ])
    p.add_argument("--code", help="Scheme code (required for --mode scheme)")
    p.add_argument("--dry-run", action="store_true", help="No DB writes")
    p.add_argument("--sample", type=int, default=0, help="Process first N items only")
    p.add_argument("--reset-checkpoint", action="store_true", help="Clear checkpoint")
    return p.parse_args()


def main():
    args = parse_args()
    client = RateLimitClient()

    if args.mode == "health":
        mode_health(client)
        return

    conn = db_connect()
    try:
        if args.mode == "scheme":
            if not args.code:
                print("ERROR: --code required for --mode scheme", file=sys.stderr)
                sys.exit(2)
            stats = mode_scheme(conn, client, args.code, args.dry_run)
            print(json.dumps(stats, indent=2))
        elif args.mode == "initial-full":
            mode_initial_full(conn, client, sample=args.sample,
                              dry_run=args.dry_run, reset_cp=args.reset_checkpoint)
        elif args.mode == "daily-metadata":
            mode_daily_metadata(conn, client, sample=args.sample, dry_run=args.dry_run)
        else:
            print(f"ERROR: mode '{args.mode}' not yet implemented (coming in MFD-005/006)",
                  file=sys.stderr)
            sys.exit(2)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
