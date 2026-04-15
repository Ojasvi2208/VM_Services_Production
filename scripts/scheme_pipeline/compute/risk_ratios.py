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
def _parse_rf(raw: str | None) -> float:
    try:
        return float((raw or "6.5").strip().rstrip("%"))
    except (TypeError, ValueError):
        return 6.5
RISK_FREE_PCT = _parse_rf(os.environ.get("PIPELINE_RISK_FREE_PCT"))

# Benchmarks with data in benchmark_data.
# Path F (2026-04-15) adds TRI variants; legacy NIFTY50/NIFTYBANK retained
# as fallback for schemes not yet remapped to TRI (mig 029).
SUPPORTED_BENCHMARKS = (
    "NIFTY50_TRI", "NIFTYBANK_TRI",
    "NIFTYMIDCAP150_TRI", "NIFTYSMALLCAP250_TRI",
    "NIFTY50", "NIFTYBANK",  # legacy, kept for graceful transition
)

# Roughly 252 trading days / year.
TRADING_DAYS = 252

# Smoke / throttle. 0 = no limit (full run). Tolerate blank env input.
LIMIT = int((os.environ.get("PIPELINE_RISK_RATIOS_LIMIT", "0") or "0").strip() or "0")

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
WITH windows(win, start_d, end_d) AS (
    VALUES
      ('1y', %(start_1y)s::date, %(end)s::date),
      ('3y', %(start_3y)s::date, %(end)s::date),
      ('5y', %(start_5y)s::date, %(end)s::date)
),
fund_rets AS (
    SELECT w.win, nh.nav_date,
           LN(nh.nav_value / LAG(nh.nav_value)
                OVER (PARTITION BY w.win ORDER BY nh.nav_date)) AS ret
    FROM windows w
    JOIN nav_history nh
      ON nh.scheme_code = %(scheme)s
     AND nh.nav_date BETWEEN w.start_d AND w.end_d
     AND nh.nav_value > 0
),
bench_rets AS (
    SELECT w.win, bd.date,
           LN(bd.value / LAG(bd.value)
                OVER (PARTITION BY w.win ORDER BY bd.date)) AS ret
    FROM windows w
    JOIN benchmark_data bd
      ON bd.benchmark_name = %(bench)s
     AND bd.date BETWEEN w.start_d AND w.end_d
     AND bd.value > 0
),
joined AS (
    SELECT f.win, f.ret AS fr, b.ret AS br
    FROM fund_rets f
    JOIN bench_rets b ON b.win = f.win AND b.date = f.nav_date
    WHERE f.ret IS NOT NULL AND b.ret IS NOT NULL
),
agg AS (
    SELECT
        win,
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
    GROUP BY win
),
endpts AS (
    SELECT w.win,
        (SELECT nav_value FROM nav_history
          WHERE scheme_code = %(scheme)s AND nav_date <= w.end_d
          ORDER BY nav_date DESC LIMIT 1) AS fund_end,
        (SELECT nav_value FROM nav_history
          WHERE scheme_code = %(scheme)s AND nav_date >= w.start_d
          ORDER BY nav_date ASC LIMIT 1) AS fund_start,
        (SELECT value FROM benchmark_data
          WHERE benchmark_name = %(bench)s AND date <= w.end_d
          ORDER BY date DESC LIMIT 1) AS bench_end,
        (SELECT value FROM benchmark_data
          WHERE benchmark_name = %(bench)s AND date >= w.start_d
          ORDER BY date ASC LIMIT 1) AS bench_start,
        GREATEST((w.end_d - w.start_d)::numeric / 365.25, 0.01) AS years
    FROM windows w
),
cagrs AS (
    SELECT win,
        CASE WHEN fund_start > 0 AND fund_end > 0 AND years > 0
             THEN (POWER(fund_end / fund_start, 1.0 / years) - 1) * 100
        END AS fund_cagr,
        CASE WHEN bench_start > 0 AND bench_end > 0 AND years > 0
             THEN (POWER(bench_end / bench_start, 1.0 / years) - 1) * 100
        END AS bench_cagr
    FROM endpts
)
SELECT
    a.win,
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
    -- Fix A: convert log-annualised mean to arithmetic-annualised pct before
    -- comparing with arithmetic risk-free rate. (EXP(log_mean * 252) - 1) * 100.
    CASE WHEN a.dd_daily > 0
         THEN ROUND((
            ((EXP(a.mean_fr * %(td)s) - 1) * 100 - %(rf)s)
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
    -- rolling_mean as arithmetic-annualised pct for consistency with sortino.
    ROUND(((EXP(a.mean_fr * %(td)s) - 1) * 100)::numeric, 4) AS rolling_mean,
    a.n_obs
FROM agg a JOIN cagrs c USING (win);
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


# Per-window minimum observations. Calibrated empirically 2026-04-15:
# fill-rate probe showed 450/750 blocked 96% of schemes due to sparse
# nav_history (median n_obs in 3y window well below 450). Dropped to
# absolute minimums that still prevent 3-month-old funds getting 5y
# metrics but let established-sparse-NAV funds qualify.
# 5y threshold kept low because nav_history backfill appears capped around
# 3 years for most schemes (investigation pending). Once historical NAV
# backfill lands, raise 5y back to ~400 for quality.
MIN_OBS = {"1y": 60, "3y": 200, "5y": 100}


def _gate(w: dict[str, Any], key: str) -> Any:
    """Return the metric only if the window has enough observations."""
    if (w.get("n_obs") or 0) < MIN_OBS.get(key, 0):
        return None
    return w.get


def _compute_one(scheme: str, bench: str, as_of, now_ts) -> tuple | None:
    """One SQL round-trip returning 3 rows (one per window). None = skip."""
    from datetime import timedelta

    rows = fetch_all(
        _WINDOW_METRICS_SQL,
        {
            "scheme": scheme,
            "bench":  bench,
            "start_1y": as_of - timedelta(days=365),
            "start_3y": as_of - timedelta(days=365 * 3),
            "start_5y": as_of - timedelta(days=365 * 5),
            "end":    as_of,
            "td":     TRADING_DAYS,
            "rf":     RISK_FREE_PCT,
        },
    )
    by_win: dict[str, dict[str, Any]] = {r["win"]: r for r in rows}
    w1, w3, w5 = by_win.get("1y", {}), by_win.get("3y", {}), by_win.get("5y", {})

    # At least 1y window must qualify; shorter series = skip scheme entirely.
    if (w1.get("n_obs") or 0) < MIN_OBS["1y"]:
        return None

    # Per-window fetchers: None when that window is too short.
    g1, g3, g5 = _gate(w1, "1y"), _gate(w3, "3y"), _gate(w5, "5y")
    G1 = (lambda k: (g1(k) if g1 else None))
    G3 = (lambda k: (g3(k) if g3 else None))
    G5 = (lambda k: (g5(k) if g5 else None))

    return (
        scheme,
        G1("alpha"),       G3("alpha"),       G5("alpha"),
        G1("beta"),        G3("beta"),        G5("beta"),
        G1("sortino"),     G3("sortino"),     G5("sortino"),
        G1("std_dev"),     G1("dd"),
        G3("ir"),          G3("te"),          G3("r_sq"),
        G3("rolling_mean"),
        G5("rolling_mean"),
        now_ts,
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

        buffer: list[tuple] = []
        written = 0
        skipped_no_data = 0
        skipped_no_asof = 0
        errored = 0
        FLUSH_EVERY = 500  # stream UPSERT so SIGKILL loses <= this many schemes
        # Fix L: single timestamp per run so downstream can group by updated_at.
        now_ts = datetime.utcnow()

        for i, r in enumerate(candidates, start=1):
            scheme, bench, as_of = r["scheme_code"], r["benchmark_name"], r["as_of"]
            if as_of is None:
                skipped_no_asof += 1
                continue
            # Fix H: per-scheme try/except so one reset doesn't nuke the run.
            try:
                row = _compute_one(scheme, bench, as_of, now_ts)
            except Exception:
                log.exception("risk_ratios: scheme=%s failed; continuing", scheme)
                errored += 1
                continue
            if row is None:
                skipped_no_data += 1
                continue
            buffer.append(row)
            if len(buffer) >= FLUSH_EVERY:
                try:
                    written += execute_batch(_UPSERT_SQL, buffer, page_size=10_000)
                except Exception:
                    log.exception("risk_ratios: flush crashed; buffered rows lost")
                    errored += len(buffer)
                log.info("risk_ratios: flushed %d/%d (total written=%d)",
                         i, len(candidates), written)
                buffer = []

        # Final flush always attempted, even if prior flush errored.
        if buffer:
            try:
                written += execute_batch(_UPSERT_SQL, buffer, page_size=10_000)
            except Exception:
                log.exception("risk_ratios: final flush crashed")
                errored += len(buffer)
            log.info("risk_ratios: final flush (total written=%d)", written)

        logger.set_row_count(written)
        logger.meta({
            "candidates":      len(candidates),
            "written":         written,
            "skipped_no_data": skipped_no_data,
            "skipped_no_asof": skipped_no_asof,
            "errored":         errored,
            "benchmarks":      list(SUPPORTED_BENCHMARKS),
            "risk_free_pct":   RISK_FREE_PCT,
            "min_obs":         MIN_OBS,
            "convention":      "log-returns throughout; rf converted via ln(1+rf/100)",
        })
        if written == 0 and len(candidates) > 0:
            logger.mark_partial()
        return written


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    print(f"wrote {run()} rows")
