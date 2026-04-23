"""
ingest-csv-metadata.py
======================
Ingest InertExpert2911/Mutual_Fund_Data CSV → funds table metadata columns.

Source: data/parquet_ingest/Mutual_Fund_Data/mutual_fund_data.csv
Target: funds table (UPDATE only, no INSERT — fund must already exist)

Columns populated (COALESCE pattern — never overwrite existing non-null):
  - amc_code         ← AMC (full AMC name, e.g. "Aditya Birla Sun Life AMC Limited")
  - category         ← Scheme_Category split on " - " (left side)
  - sub_category     ← Scheme_Category split on " - " (right side)
  - min_investment   ← Scheme_Min_Amt
  - fund_size        ← Average_AUM_Cr (in Crores)
  - isin_growth      ← ISIN_Div_Payout/Growth (skip '-')
  - isin_div_reinvestment ← ISIN_Div_Reinvestment (skip '-')
  - inception_date   ← Launch_Date (skip NULL/invalid)

Columns NOT populated by this CSV (require different source):
  - expense_ratio, exit_load, min_sip

Usage:
  python3 scripts/ingest-csv-metadata.py                # full run
  python3 scripts/ingest-csv-metadata.py --dry-run      # simulate
  python3 scripts/ingest-csv-metadata.py --sample 500   # first 500 rows
"""

import argparse
import csv
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import psycopg2
import psycopg2.extras

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway",
)
CSV_PATH = Path(__file__).parent.parent / "data" / "parquet_ingest" / "Mutual_Fund_Data" / "mutual_fund_data.csv"
BATCH_SIZE = 500


def parse_args():
    p = argparse.ArgumentParser(description="Ingest CSV metadata into funds table")
    p.add_argument("--dry-run", action="store_true", help="Preview only, no DB writes")
    p.add_argument("--sample", type=int, default=0, help="First N rows (0=all)")
    return p.parse_args()


def parse_category(scheme_category: str) -> tuple[str | None, str | None]:
    """Split 'Equity Scheme - Large & Mid Cap Fund' → ('Equity', 'Large & Mid Cap Fund')."""
    if not scheme_category or scheme_category == "-":
        return None, None
    parts = scheme_category.split(" - ", 1)
    category = parts[0].replace(" Scheme", "").replace(" Schemes", "").strip() or None
    sub = parts[1].strip() if len(parts) > 1 else None
    cat_map = {"Equity": "Equity", "Debt": "Debt", "Hybrid": "Hybrid",
               "Other": "Other", "Solution": "Solution Oriented"}
    if category:
        for key, val in cat_map.items():
            if key.lower() in category.lower():
                category = val
                break
    return category, sub


def parse_numeric(val: str) -> float | None:
    """Parse numeric string, return None for empty/dash/invalid."""
    if not val or val.strip() in ("", "-", "NA", "null", "None"):
        return None
    try:
        # Handle comma-thousands separators
        clean = val.replace(",", "").strip()
        return float(clean)
    except (ValueError, TypeError):
        return None


def parse_date(val: str):
    """Parse YYYY-MM-DD, return None for empty/invalid."""
    if not val or val.strip() in ("", "-", "NA", "null", "None"):
        return None
    try:
        return datetime.strptime(val.strip(), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def parse_isin(val: str) -> str | None:
    """ISIN or None if '-' placeholder."""
    if not val or val.strip() in ("", "-", "NA"):
        return None
    return val.strip()


def build_update_tuple(row: dict) -> tuple | None:
    """Build update tuple for funds table. Returns None if scheme_code missing."""
    sc = row.get("Scheme_Code", "").strip()
    if not sc:
        return None

    amc = row.get("AMC", "").strip() or None
    if amc and len(amc) > 50:
        amc = amc[:50]  # amc_code VARCHAR(50); future migration should widen this
    category, sub_category = parse_category(row.get("Scheme_Category", ""))
    min_inv = parse_numeric(row.get("Scheme_Min_Amt", ""))
    fund_size = parse_numeric(row.get("Average_AUM_Cr", ""))
    isin_g = parse_isin(row.get("ISIN_Div_Payout/Growth", ""))
    isin_d = parse_isin(row.get("ISIN_Div_Reinvestment", ""))
    inception = parse_date(row.get("Launch_Date", ""))

    return (amc, category, sub_category, min_inv, fund_size, isin_g, isin_d, inception, sc)


def apply_batch(cur, batch: list[tuple]) -> int:
    """UPDATE funds using COALESCE to preserve existing values."""
    if not batch:
        return 0
    # Use execute_values with UPDATE via temporary VALUES clause
    sql = """
        UPDATE funds SET
            amc_code = COALESCE(funds.amc_code, v.amc),
            category = COALESCE(funds.category, v.cat),
            sub_category = COALESCE(funds.sub_category, v.subcat),
            min_investment = COALESCE(funds.min_investment, v.min_inv),
            fund_size = COALESCE(funds.fund_size, v.fsize),
            isin_growth = COALESCE(funds.isin_growth, v.isin_g),
            isin_div_reinvestment = COALESCE(funds.isin_div_reinvestment, v.isin_d),
            inception_date = COALESCE(funds.inception_date, v.inception),
            updated_at = NOW()
        FROM (VALUES %s) AS v(amc, cat, subcat, min_inv, fsize, isin_g, isin_d, inception, sc)
        WHERE funds.scheme_code = v.sc
    """
    psycopg2.extras.execute_values(
        cur, sql, batch,
        template="(%s, %s, %s, %s::numeric, %s::numeric, %s, %s, %s::date, %s)",
        page_size=BATCH_SIZE,
    )
    return cur.rowcount


def main():
    args = parse_args()

    if not CSV_PATH.exists():
        print(f"ERROR: CSV not found at {CSV_PATH}", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(DB_URL, connect_timeout=30)
    conn.autocommit = False
    cur = conn.cursor()

    start = time.time()
    batch: list[tuple] = []
    total_rows = 0
    total_applied = 0
    skipped_no_sc = 0
    sample_cap = args.sample if args.sample > 0 else None

    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if sample_cap and total_rows >= sample_cap:
                break
            total_rows += 1
            t = build_update_tuple(row)
            if t is None:
                skipped_no_sc += 1
                continue
            batch.append(t)
            if len(batch) >= BATCH_SIZE:
                if not args.dry_run:
                    rc = apply_batch(cur, batch)
                    conn.commit()
                    total_applied += rc
                else:
                    total_applied += len(batch)
                batch.clear()

    # Flush remainder
    if batch:
        if not args.dry_run:
            rc = apply_batch(cur, batch)
            conn.commit()
            total_applied += rc
        else:
            total_applied += len(batch)

    cur.close()
    conn.close()

    elapsed = time.time() - start
    print(f"[done] CSV rows read: {total_rows:,}")
    print(f"[done] Skipped (no scheme_code): {skipped_no_sc:,}")
    print(f"[done] Rows applied to funds: {total_applied:,} {'(dry-run)' if args.dry_run else ''}")
    print(f"[done] Elapsed: {elapsed:.1f}s ({total_rows/elapsed:.0f} rows/sec)")


if __name__ == "__main__":
    main()
