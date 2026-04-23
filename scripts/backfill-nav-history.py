"""
backfill-nav-history.py
=======================
Backfill NAV history + fund metadata from mfapi.in for all active Direct Growth funds.

Usage:
  python3 scripts/backfill-nav-history.py                    # all active Direct Growth
  python3 scripts/backfill-nav-history.py --scheme 119551    # single scheme
  python3 scripts/backfill-nav-history.py --limit 50         # first 50 schemes
  python3 scripts/backfill-nav-history.py --dry-run          # preview, no DB writes

What it fills:
  - nav_history: full historical NAV (source='M' for mfapi)
  - funds.category, funds.sub_category (from scheme_category)
  - funds.isin_growth, funds.isin_div_reinvestment
  - (amc_code stays NULL — fundHouse now comes from master_funds JOIN)

Rate limit: 2 req/sec with exponential backoff on 429/5xx.
Checkpoint: saves progress to /tmp/nav_backfill_checkpoint.json.
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import psycopg2
import psycopg2.extras
import requests

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway",
)
MFAPI_BASE = "https://api.mfapi.in/mf"
CHECKPOINT_FILE = Path("/tmp/nav_backfill_checkpoint.json")
BATCH_SIZE = 500  # rows per INSERT batch
REQ_DELAY = 0.5   # seconds between requests (2 req/sec)


def parse_args():
    p = argparse.ArgumentParser(description="Backfill NAV history from mfapi.in")
    p.add_argument("--scheme", type=str, help="Single scheme_code to backfill")
    p.add_argument("--limit", type=int, default=0, help="Max schemes to process (0=all)")
    p.add_argument("--dry-run", action="store_true", help="Preview only, no DB writes")
    p.add_argument("--skip-nav", action="store_true", help="Skip NAV history, only update metadata")
    p.add_argument("--reset", action="store_true", help="Clear checkpoint and start fresh")
    return p.parse_args()


def load_checkpoint():
    if CHECKPOINT_FILE.exists():
        return json.loads(CHECKPOINT_FILE.read_text())
    return {"completed": [], "last_run": None}


def save_checkpoint(cp):
    cp["last_run"] = datetime.now().isoformat()
    CHECKPOINT_FILE.write_text(json.dumps(cp, indent=2))


def fetch_mfapi(scheme_code: str, retries: int = 3) -> dict | None:
    """Fetch from mfapi.in with retry + backoff."""
    url = f"{MFAPI_BASE}/{scheme_code}"
    for attempt in range(retries):
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "SUCCESS" or "meta" in data:
                    return data
                return None
            if resp.status_code == 404:
                return None
            if resp.status_code in (429, 500, 502, 503):
                wait = (2 ** attempt) * 1.5
                print(f"    [{resp.status_code}] retrying in {wait:.0f}s...")
                time.sleep(wait)
                continue
        except requests.RequestException as e:
            print(f"    Network error: {e}")
            time.sleep(2 ** attempt)
    return None


def parse_category(scheme_category: str) -> tuple[str | None, str | None]:
    """Parse mfapi scheme_category like 'Debt Scheme - Banking and PSU Fund'
    into (category, sub_category)."""
    if not scheme_category:
        return None, None
    parts = scheme_category.split(" - ", 1)
    category = parts[0].replace(" Scheme", "").replace(" Schemes", "").strip()
    sub_category = parts[1].strip() if len(parts) > 1 else None
    # Normalize
    cat_map = {"Equity": "Equity", "Debt": "Debt", "Hybrid": "Hybrid",
               "Other": "Other", "Solution Oriented": "Solution Oriented"}
    for key, val in cat_map.items():
        if key.lower() in category.lower():
            category = val
            break
    return category, sub_category


def update_fund_metadata(cur, scheme_code: str, meta: dict):
    """Update funds table with metadata from mfapi.in meta block."""
    category, sub_category = parse_category(meta.get("scheme_category", ""))
    isin_growth = meta.get("isin_growth") or None
    isin_div = meta.get("isin_div_reinvestment") or None

    # Only update NULL columns — don't overwrite existing data
    cur.execute("""
        UPDATE funds SET
            category = COALESCE(category, %s),
            sub_category = COALESCE(sub_category, %s),
            isin_growth = COALESCE(isin_growth, %s),
            isin_div_reinvestment = COALESCE(isin_div_reinvestment, %s),
            updated_at = NOW()
        WHERE scheme_code = %s
    """, (category, sub_category, isin_growth, isin_div, scheme_code))
    return cur.rowcount


def upsert_nav_batch(cur, rows: list[tuple]):
    """Bulk upsert NAV rows. Each row: (scheme_code, nav_date, nav_value, 'M')."""
    if not rows:
        return 0
    psycopg2.extras.execute_values(
        cur,
        """INSERT INTO nav_history (scheme_code, nav_date, nav_value, source)
           VALUES %s
           ON CONFLICT (scheme_code, nav_date) DO NOTHING""",
        rows,
        template="(%s, %s, %s, %s)",
        page_size=BATCH_SIZE,
    )
    return len(rows)


def process_scheme(cur, scheme_code: str, dry_run: bool, skip_nav: bool) -> dict:
    """Process a single scheme. Returns stats dict."""
    stats = {"nav_inserted": 0, "meta_updated": False, "error": None}

    data = fetch_mfapi(scheme_code)
    if not data:
        stats["error"] = "mfapi returned no data"
        return stats

    meta = data.get("meta", {})

    # Update metadata
    if not dry_run:
        rows_updated = update_fund_metadata(cur, scheme_code, meta)
        stats["meta_updated"] = rows_updated > 0
    else:
        stats["meta_updated"] = True

    # NAV history
    if not skip_nav:
        nav_data = data.get("data", [])
        if nav_data:
            rows = []
            for entry in nav_data:
                try:
                    nav_date = datetime.strptime(entry["date"], "%d-%m-%Y").date()
                    nav_value = float(entry["nav"])
                    rows.append((scheme_code, nav_date, nav_value, "M"))
                except (ValueError, KeyError):
                    continue

            if not dry_run:
                stats["nav_inserted"] = upsert_nav_batch(cur, rows)
            else:
                stats["nav_inserted"] = len(rows)

    time.sleep(REQ_DELAY)
    return stats


def main():
    args = parse_args()
    cp = load_checkpoint() if not args.reset else {"completed": [], "last_run": None}

    if args.reset and CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()
        print("Checkpoint cleared.")

    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    # Get schemes to process
    if args.scheme:
        schemes = [args.scheme]
    else:
        cur.execute("""
            SELECT scheme_code FROM funds
            WHERE is_active = true AND plan_type = 'Direct' AND option_type = 'Growth'
            ORDER BY scheme_code
        """)
        schemes = [r[0] for r in cur.fetchall()]

    # Filter already completed
    completed_set = set(cp["completed"])
    schemes = [s for s in schemes if s not in completed_set]

    if args.limit > 0:
        schemes = schemes[:args.limit]

    total = len(schemes)
    print(f"Schemes to process: {total} (skipping {len(completed_set)} already done)")
    if args.dry_run:
        print("DRY RUN — no DB writes")

    total_nav = 0
    total_meta = 0
    errors = 0

    for i, sc in enumerate(schemes, 1):
        print(f"[{i}/{total}] {sc} ...", end=" ", flush=True)
        try:
            stats = process_scheme(cur, sc, args.dry_run, args.skip_nav)
            if stats["error"]:
                print(f"SKIP ({stats['error']})")
                errors += 1
            else:
                nav_str = f"nav={stats['nav_inserted']}" if not args.skip_nav else ""
                meta_str = "meta=YES" if stats["meta_updated"] else "meta=no"
                print(f"OK  {nav_str} {meta_str}")
                total_nav += stats["nav_inserted"]
                if stats["meta_updated"]:
                    total_meta += 1

            if not args.dry_run:
                conn.commit()
                cp["completed"].append(sc)
                if i % 10 == 0:
                    save_checkpoint(cp)

        except Exception as e:
            conn.rollback()
            print(f"ERROR: {e}")
            errors += 1

    if not args.dry_run:
        save_checkpoint(cp)

    conn.close()

    print(f"\n{'DRY RUN ' if args.dry_run else ''}SUMMARY:")
    print(f"  Schemes processed: {total - errors}/{total}")
    print(f"  NAV rows inserted: {total_nav:,}")
    print(f"  Metadata updated:  {total_meta}")
    print(f"  Errors:            {errors}")


if __name__ == "__main__":
    main()
