"""
ingest-parquet-nav.py
=====================
Ingest InertExpert2911/Mutual_Fund_Data parquet (21.5M NAV rows) into nav_history.

Usage:
  python3 scripts/ingest-parquet-nav.py                    # full ingest (all 21 row groups)
  python3 scripts/ingest-parquet-nav.py --dry-run          # simulate, no DB writes
  python3 scripts/ingest-parquet-nav.py --sample 100000    # first 100K rows only (test)
  python3 scripts/ingest-parquet-nav.py --start-group 5    # resume from row group 5
  python3 scripts/ingest-parquet-nav.py --skip-fk-check    # skip funds FK pre-check (faster, trusts caller)

Source: github.com/InertExpert2911/Mutual_Fund_Data → mutual_fund_nav_history.parquet
Maps parquet (Scheme_Code int64, Date timestamp, NAV double) to nav_history (scheme_code text, nav_date date, nav_value numeric, source='P')

Strategy:
  - Stream row-group by row-group (21 groups, ~1M rows each) to bound memory
  - FK-filter against funds table (parquet has 14,987 schemes, funds has 17,460 — intersection only)
  - Bulk UPSERT via execute_values with ON CONFLICT DO NOTHING (pk = scheme_code, nav_date)
  - Checkpoint after each row group to /tmp/parquet_ingest_checkpoint.json
  - Progress reporter: rows written, rows skipped (FK or conflict), elapsed, ETA

Safety:
  - Dry-run tested first on 100K sample
  - No DELETEs, no TRUNCATEs — only additive UPSERT
  - Source='P' distinguishes parquet-originated rows from A (AMFI), M (mfapi), B (legacy bulk)
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
import pyarrow.parquet as pq

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway",
)
PARQUET_PATH = Path(__file__).parent.parent / "data" / "parquet_ingest" / "Mutual_Fund_Data" / "mutual_fund_nav_history.parquet"
CHECKPOINT_FILE = Path("/tmp/parquet_ingest_checkpoint.json")
BATCH_SIZE = 10_000       # rows per UPSERT execute_values call
PAGE_SIZE = 10_000        # psycopg2 execute_values page_size (match BATCH_SIZE to avoid paging bug)


def parse_args():
    p = argparse.ArgumentParser(description="Ingest parquet NAV history into nav_history")
    p.add_argument("--dry-run", action="store_true", help="Preview only, no DB writes")
    p.add_argument("--sample", type=int, default=0, help="Max rows to process (0=all)")
    p.add_argument("--start-group", type=int, default=0, help="Resume from row group N (0-indexed)")
    p.add_argument("--skip-fk-check", action="store_true", help="Skip FK filter (trusts all scheme_codes)")
    p.add_argument("--reset-checkpoint", action="store_true", help="Clear checkpoint, start fresh")
    return p.parse_args()


def load_checkpoint():
    if CHECKPOINT_FILE.exists():
        return json.loads(CHECKPOINT_FILE.read_text())
    return {"completed_groups": [], "total_inserted": 0, "total_skipped_fk": 0, "last_run": None}


def save_checkpoint(cp):
    cp["last_run"] = datetime.now().isoformat()
    CHECKPOINT_FILE.write_text(json.dumps(cp, indent=2))


def load_valid_scheme_codes(conn) -> set[str]:
    """Pull all scheme_codes from funds table (for FK pre-filter)."""
    cur = conn.cursor()
    cur.execute("SELECT scheme_code FROM funds")
    rows = cur.fetchall()
    cur.close()
    return {r[0] for r in rows}


def upsert_batch(cur, rows: list[tuple]) -> int:
    """UPSERT a batch of (scheme_code, nav_date, nav_value, source) tuples.
    Returns rows inserted (excludes conflicts)."""
    if not rows:
        return 0
    psycopg2.extras.execute_values(
        cur,
        """INSERT INTO nav_history (scheme_code, nav_date, nav_value, source)
           VALUES %s
           ON CONFLICT (scheme_code, nav_date) DO NOTHING""",
        rows,
        template="(%s, %s, %s, %s)",
        page_size=PAGE_SIZE,
    )
    return cur.rowcount  # rows actually inserted (not skipped by conflict)


def format_duration(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.0f}s"
    if seconds < 3600:
        return f"{seconds/60:.1f}m"
    return f"{seconds/3600:.1f}h"


def main():
    args = parse_args()

    if args.reset_checkpoint and CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()
        print("[reset] Checkpoint cleared.")

    if not PARQUET_PATH.exists():
        print(f"ERROR: Parquet file not found at {PARQUET_PATH}", file=sys.stderr)
        print("Run: git clone https://github.com/InertExpert2911/Mutual_Fund_Data.git "
              "into data/parquet_ingest/ and git lfs pull", file=sys.stderr)
        sys.exit(1)

    pf = pq.ParquetFile(str(PARQUET_PATH))
    total_rows = pf.metadata.num_rows
    total_groups = pf.metadata.num_row_groups
    print(f"[parquet] {PARQUET_PATH.name}")
    print(f"[parquet] {total_rows:,} total rows across {total_groups} row groups")

    cp = load_checkpoint()
    if cp["completed_groups"]:
        print(f"[resume] Previously completed groups: {cp['completed_groups']}")
        print(f"[resume] Previously inserted: {cp['total_inserted']:,} rows")

    conn = psycopg2.connect(DB_URL, connect_timeout=30)
    conn.autocommit = False

    valid_schemes: set[str] | None = None
    if not args.skip_fk_check:
        print("[fk-check] Loading valid scheme_codes from funds table...")
        valid_schemes = load_valid_scheme_codes(conn)
        print(f"[fk-check] {len(valid_schemes):,} valid schemes loaded")

    cur = conn.cursor()

    total_inserted = cp["total_inserted"]
    total_skipped_fk = cp["total_skipped_fk"]
    total_processed = 0
    start_ts = time.time()
    sample_cap = args.sample if args.sample > 0 else None

    for group_idx in range(total_groups):
        if group_idx < args.start_group:
            continue
        if group_idx in cp["completed_groups"]:
            print(f"[skip] Row group {group_idx} already completed")
            continue
        if sample_cap is not None and total_processed >= sample_cap:
            print(f"[sample] Reached cap of {sample_cap:,} rows")
            break

        group_start = time.time()
        table = pf.read_row_group(group_idx)
        group_rows = table.num_rows
        print(f"[group {group_idx+1}/{total_groups}] {group_rows:,} rows — parsing...")

        # Extract columns as python lists (arrow → native)
        # Scheme_Code is index in pandas, but in arrow it's a regular column
        scheme_codes = table['Scheme_Code'].to_pylist()
        dates = table['Date'].to_pylist()
        navs = table['NAV'].to_pylist()

        batch: list[tuple] = []
        group_inserted = 0
        group_skipped_fk = 0

        for i in range(group_rows):
            if sample_cap is not None and total_processed >= sample_cap:
                break

            sc_int = scheme_codes[i]
            if sc_int is None:
                continue
            sc = str(sc_int)

            # FK pre-filter
            if valid_schemes is not None and sc not in valid_schemes:
                group_skipped_fk += 1
                total_processed += 1
                continue

            nav_date = dates[i]
            nav_val = navs[i]
            if nav_date is None or nav_val is None:
                total_processed += 1
                continue

            # Convert pandas/arrow timestamp → date
            if hasattr(nav_date, 'date'):
                nav_date = nav_date.date()

            batch.append((sc, nav_date, float(nav_val), 'P'))
            total_processed += 1

            if len(batch) >= BATCH_SIZE:
                if not args.dry_run:
                    inserted = upsert_batch(cur, batch)
                    conn.commit()
                    group_inserted += inserted
                batch.clear()

        # Flush remainder
        if batch and not args.dry_run:
            inserted = upsert_batch(cur, batch)
            conn.commit()
            group_inserted += inserted
        elif batch and args.dry_run:
            group_inserted += len(batch)  # simulate

        total_inserted += group_inserted
        total_skipped_fk += group_skipped_fk
        group_elapsed = time.time() - group_start
        total_elapsed = time.time() - start_ts
        rows_per_sec = total_processed / total_elapsed if total_elapsed > 0 else 0
        rows_remaining = total_rows - total_processed
        eta = rows_remaining / rows_per_sec if rows_per_sec > 0 else 0

        print(f"[group {group_idx+1}/{total_groups}] "
              f"inserted={group_inserted:,} skipped_fk={group_skipped_fk:,} "
              f"elapsed={format_duration(group_elapsed)} "
              f"| total_inserted={total_inserted:,} "
              f"eta={format_duration(eta)}")

        if not args.dry_run:
            cp["completed_groups"].append(group_idx)
            cp["total_inserted"] = total_inserted
            cp["total_skipped_fk"] = total_skipped_fk
            save_checkpoint(cp)

    cur.close()
    conn.close()

    total_elapsed = time.time() - start_ts
    print("---")
    print(f"[done] Total processed: {total_processed:,}")
    print(f"[done] Total inserted: {total_inserted:,} "
          f"{'(dry-run)' if args.dry_run else ''}")
    print(f"[done] Skipped (FK mismatch): {total_skipped_fk:,}")
    print(f"[done] Elapsed: {format_duration(total_elapsed)}")
    if total_processed > 0:
        print(f"[done] Throughput: {total_processed/total_elapsed:.0f} rows/sec")


if __name__ == "__main__":
    main()
