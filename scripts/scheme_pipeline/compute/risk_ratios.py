"""risk_ratios — populate the 16 ratio columns added in migration 023 (DATA-005).

Per scheme × per window (1y/3y/5y):
  alpha, beta, sortino, std_dev, downside_dev,
  tracking_error, info_ratio, r_squared, rolling_mean.

All metrics computed in-SQL via CTE (log returns on nav_history / benchmark_data,
aligned by date). No Python numerics — Postgres does the work.

Scope v1:
  - Only schemes mapped to benchmarks that exist in benchmark_data
    (NIFTY50, NIFTYBANK as of 2026-04-15 — Path A proxy).
  - Debt/liquid funds (null benchmark) deferred to v2.

Proxy caveat: benchmark_data for NIFTY50/NIFTYBANK is Yahoo price close,
NOT TRI. Alpha will read ~150bps high. Provenance lives in
ingestion_run.metadata.source='yahoo_price_proxy' from yahoo_nifty_history.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any

from ..core.db import execute_batch, fetch_all
from ..core.logger import IngestionLogger

log = logging.getLogger(__name__)

SOURCE = "compute"
JOB = "risk_ratios"

# India 10yr govt bond yield proxy. Override via env when T-bill adapter lands.
RISK_FREE_PCT = float(os.environ.get("PIPELINE_RISK_FREE_PCT", "6.5"))

# Only benchmarks with data in benchmark_data (post Path A).
SUPPORTED_BENCHMARKS = ("NIFTY50", "NIFTYBANK")

# Roughly 252 trading days / year.
TRADING_DAYS = 252

# Smoke / throttle. 0 = no limit (full run).
LIMIT = int(os.environ.get("PIPELINE_RISK_RATIOS_LIMIT", "0"))

# Columns this job writes. Pre-flight checks these exist in fund_returns.
REQUIRED_COLS = (
    "alpha_1y", "alpha_3y", "alpha_5y",
    "beta_1y", "beta_3y", "beta_5y",
    "sortino_1y", "sortino_3y", "sortino_5y",
    "std_dev_1y", "downside_deviation_1y",
    "information_ratio_3y", "tracking_error_3y", "r_squared_3y",
    "rolling_3y_mean", "rolling_5y_mean",
)

# Candidate list: schemes in scheme_benchmark_map pointing at a supported
# benchmark, joined with funds for FK safety. One row per scheme.
_CANDIDATES_SQL = """
SELECT
    f.scheme_code,
    m.benchmark_name,
    (SELECT MAX(nav_date) FROM nav_history WHERE scheme_code = f.scheme_code) AS as_of
FROM funds f
JOIN scheme_benchmark_map m USING (scheme_code)
WHERE m.benchmark_name = ANY(%s);
"""

# Monolithic per-scheme × per-window metrics. Parameterised on scheme + benchmark
# + two dates. Log returns on nav_history and benchmark_data, aligned by date.
# Returns one row with every metric for the requested window.
_WINDOW_METRICS_SQL = """
WITH fund_rets AS (
    SELECT nav_date,
           LN(nav_value / LAG(nav_value) OVER (ORDER BY nav_date)) AS ret
    FROM nav_history
    WHERE scheme_code = %(scheme)s
      AND nav_date BETWEEN %(start)s AND %(end)s
      AND nav_value > 0
),
bench_rets AS (
    SELECT date,
           LN(value / LAG(value) OVER (ORDER BY date)) AS ret
    FROM benchmark_data
    WHERE benchmark_name = %(bench)s
      AND date BETWEEN %(start)s AND %(end)s
      AND value > 0
),
joined AS (
    SELECT f.ret AS fr, b.ret AS br
    FROM fund_rets f JOIN bench_rets b ON f.nav_date = b.date
    WHERE f.ret IS NOT NULL AND b.ret IS NOT NULL
),
agg AS (
    SELECT
        COVAR_POP(fr, br)                                   AS cov_fb,
        VAR_POP(br)                                         AS var_b,
        CORR(fr, br)                                        AS corr_fb,
        AVG(fr - br)                                        AS mean_excess,
        STDDEV_SAMP(fr - br)                                AS sd_excess,
        STDDEV_SAMP(fr)                                     AS sd_fund,
        AVG(fr)                                             AS mean_fr,
        SQRT(AVG(CASE WHEN fr < 0 THEN fr * fr ELSE 0 END)) AS dd_daily,
        COUNT(*)                                            AS n_obs
    FROM joined
),
endpts AS (
    SELECT
        (SELECT nav_value FROM nav_history
          WHERE scheme_code = %(scheme)s AND nav_date <= %(end)s
          ORDER BY nav_date DESC LIMIT 1) AS fund_end,
        (SELECT nav_value FROM nav_history
          WHERE scheme_code = %(scheme)s AND nav_date >= %(start)s
          ORDER BY nav_date ASC LIMIT 1) AS fund_start,
        (SELECT value FROM benchmark_data
          WHERE benchmark_name = %(bench)s AND date <= %(end)s
          ORDER BY date DESC LIMIT 1) AS bench_end,
        (SELECT value FROM benchmark_data
          WHERE benchmark_name = %(bench)s AND date >= %(start)s
          ORDER BY date ASC LIMIT 1) AS bench_start,
        GREATEST(
            EXTRACT(EPOCH FROM (%(end)s::date - %(start)s::date)) / 86400.0 / 365.25,
            0.01
        ) AS years
),
cagrs AS (
    SELECT
        CASE WHEN fund_start > 0 AND fund_end > 0 AND years > 0
             THEN (POWER(fund_end / fund_start, 1.0 / years) - 1) * 100
        END AS fund_cagr,
        CASE WHEN bench_start > 0 AND bench_end > 0 AND years > 0
             THEN (POWER(bench_end / bench_start, 1.0 / years) - 1) * 100
        END AS bench_cagr
    FROM endpts
)
SELECT
    CASE WHEN a.var_b > 0 THEN ROUND((a.cov_fb / a.var_b)::numeric, 4) END AS beta,
    CASE WHEN a.corr_fb IS NOT NULL THEN ROUND((a.corr_fb * a.corr_fb)::numeric, 4) END AS r_sq,
    CASE WHEN a.sd_excess IS NOT NULL
         THEN ROUND((a.sd_excess * SQRT(%(td)s) * 100)::numeric, 4) END AS te,
    CASE WHEN a.sd_excess > 0
         THEN ROUND(((a.mean_excess * %(td)s) / (a.sd_excess * SQRT(%(td)s)))::numeric, 4)
    END AS ir,
    CASE WHEN a.sd_fund IS NOT NULL
         THEN ROUND((a.sd_fund * SQRT(%(td)s) * 100)::numeric, 4) END AS std_dev,
    CASE WHEN a.dd_daily IS NOT NULL
         THEN ROUND((a.dd_daily * SQRT(%(td)s) * 100)::numeric, 4) END AS dd,
    CASE WHEN a.dd_daily > 0
         THEN ROUND((
            (a.mean_fr * %(td)s * 100 - %(rf)s)
            / (a.dd_daily * SQRT(%(td)s) * 100)
         )::numeric, 4)
    END AS sortino,
    CASE WHEN a.n_obs > 0 AND a.var_b > 0
              AND c.fund_cagr IS NOT NULL AND c.bench_cagr IS NOT NULL
         THEN ROUND(
             (c.fund_cagr - (%(rf)s + (a.cov_fb / a.var_b) * (c.bench_cagr - %(rf)s)))::numeric,
             4
         )
    END AS alpha,
    ROUND((a.mean_fr * %(td)s * 100)::numeric, 4) AS rolling_mean,
    a.n_obs
FROM agg a CROSS JOIN cagrs c;
"""

# UPSERT the 16 columns from migration 023.
_UPSERT_SQL = """
INSERT INTO fund_returns (
    scheme_code,
    alpha_1y, alpha_3y, alpha_5y,
    beta_1y, beta_3y, beta_5y,
    sortino_1y, sortino_3y, sortino_5y,
    std_dev_1y, downside_deviation_1y,
    information_ratio_3y, tracking_error_3y, r_squared_3y,
    rolling_3y_mean, rolling_5y_mean,
    updated_at
) VALUES %s
ON CONFLICT (scheme_code) DO UPDATE SET
    alpha_1y = EXCLUDED.alpha_1y,
    alpha_3y = EXCLUDED.alpha_3y,
    alpha_5y = EXCLUDED.alpha_5y,
    beta_1y  = EXCLUDED.beta_1y,
    beta_3y  = EXCLUDED.beta_3y,
    beta_5y  = EXCLUDED.beta_5y,
    sortino_1y = EXCLUDED.sortino_1y,
    sortino_3y = EXCLUDED.sortino_3y,
    sortino_5y = EXCLUDED.sortino_5y,
    std_dev_1y = EXCLUDED.std_dev_1y,
    downside_deviation_1y = EXCLUDED.downside_deviation_1y,
    information_ratio_3y  = EXCLUDED.information_ratio_3y,
    tracking_error_3y     = EXCLUDED.tracking_error_3y,
    r_squared_3y          = EXCLUDED.r_squared_3y,
    rolling_3y_mean = EXCLUDED.rolling_3y_mean,
    rolling_5y_mean = EXCLUDED.rolling_5y_mean,
    updated_at = NOW();
"""


def _window_metrics(scheme: str, bench: str, start, end) -> dict[str, Any]:
    """Run the monolithic SQL for one scheme × one window. Empty dict on no data."""
    rows = fetch_all(
        _WINDOW_METRICS_SQL,
        {"scheme": scheme, "bench": bench, "start": start, "end": end,
         "td": TRADING_DAYS, "rf": RISK_FREE_PCT},
    )
    if not rows:
        return {}
    return rows[0]


def _compute_one(scheme: str, bench: str, as_of) -> tuple | None:
    """Return the UPSERT tuple for one scheme, or None if insufficient data."""
    from datetime import timedelta

    w1 = _window_metrics(scheme, bench, as_of - timedelta(days=365),     as_of)
    w3 = _window_metrics(scheme, bench, as_of - timedelta(days=365 * 3), as_of)
    w5 = _window_metrics(scheme, bench, as_of - timedelta(days=365 * 5), as_of)

    # Skip schemes with <60 obs in 1y (junk data).
    if not w1 or (w1.get("n_obs") or 0) < 60:
        return None

    return (
        scheme,
        w1.get("alpha"),       w3.get("alpha"),       w5.get("alpha"),
        w1.get("beta"),        w3.get("beta"),        w5.get("beta"),
        w1.get("sortino"),     w3.get("sortino"),     w5.get("sortino"),
        w1.get("std_dev"),     w1.get("dd"),
        w3.get("ir"),          w3.get("te"),          w3.get("r_sq"),
        w3.get("rolling_mean"),
        w5.get("rolling_mean"),
        datetime.utcnow(),
    )


def _preflight_schema() -> None:
    """Fail fast if prod fund_returns is missing any column we write."""
    rows = fetch_all(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'fund_returns' AND column_name = ANY(%s);
        """,
        (list(REQUIRED_COLS),),
    )
    present = {r["column_name"] for r in rows}
    missing = [c for c in REQUIRED_COLS if c not in present]
    if missing:
        raise RuntimeError(
            f"fund_returns missing columns (did migration 023 apply?): {missing}"
        )


def run() -> int:
    with IngestionLogger(source=SOURCE, job_name=JOB) as logger:
        _preflight_schema()
        candidates = fetch_all(_CANDIDATES_SQL, (list(SUPPORTED_BENCHMARKS),))
        if LIMIT > 0:
            candidates = candidates[:LIMIT]
            log.info("risk_ratios: LIMIT=%d applied", LIMIT)
        log.info("risk_ratios: %d candidates (benchmarks=%s, rf=%.2f)",
                 len(candidates), SUPPORTED_BENCHMARKS, RISK_FREE_PCT)

        payload: list[tuple] = []
        skipped_no_data = 0
        skipped_no_asof = 0

        for r in candidates:
            scheme, bench, as_of = r["scheme_code"], r["benchmark_name"], r["as_of"]
            if as_of is None:
                skipped_no_asof += 1
                continue
            row = _compute_one(scheme, bench, as_of)
            if row is None:
                skipped_no_data += 1
                continue
            payload.append(row)

        # Oversized page_size so multi-page rowcount bug doesn't under-report.
        # (see ~/.claude/projects/…/memory/pipeline_execute_batch_paging_bug.md)
        written = execute_batch(_UPSERT_SQL, payload, page_size=10_000) if payload else 0

        logger.set_row_count(written)
        logger.meta({
            "candidates":      len(candidates),
            "written":         written,
            "skipped_no_data": skipped_no_data,
            "skipped_no_asof": skipped_no_asof,
            "benchmarks":      list(SUPPORTED_BENCHMARKS),
            "risk_free_pct":   RISK_FREE_PCT,
            "proxy_warning":   "benchmark_data is Yahoo price-close, NOT TRI. "
                               "Alpha/IR skewed. Replace once real TRI lands.",
        })
        if written == 0 and len(candidates) > 0:
            logger.mark_partial()
        return written


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    print(f"wrote {run()} rows")
