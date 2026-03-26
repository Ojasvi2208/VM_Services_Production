"""
Akshaya Market State Scraping Service.
FastAPI + APScheduler background worker.
Singleton in-memory cache → zero external calls on user requests.
Persists to PostgreSQL market_cache table for cross-service access.
"""

import json
import logging
import os
from contextlib import asynccontextmanager

import psycopg2
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from cache import MarketStateCache
from models import HealthResponse, MarketStateResponse, StalenessInfo
from scrapers import scrape_fii_dii, scrape_index_movers, scrape_nifty_constituents

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("main")

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set. "
        "Set it to the Railway PostgreSQL connection string before starting the scraper."
    )
SCRAPER_INTERVAL = int(os.environ.get("SCRAPER_INTERVAL_MINUTES", "30"))

cache = MarketStateCache()
scheduler = AsyncIOScheduler()


def _get_db_conn():
    return psycopg2.connect(DATABASE_URL, sslmode="require")


def persist_to_db(cache_key: str, data: dict, source_url: str = ""):
    """Write cache entry to PostgreSQL market_cache for Next.js consumption."""
    try:
        conn = _get_db_conn()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO market_cache (cache_key, data, scraped_at, is_stale, source_url, updated_at)
            VALUES (%s, %s, NOW(), false, %s, NOW())
            ON CONFLICT (cache_key) DO UPDATE SET
                data = EXCLUDED.data,
                scraped_at = NOW(),
                is_stale = false,
                source_url = EXCLUDED.source_url,
                updated_at = NOW()
            """,
            (cache_key, json.dumps(data), source_url),
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"DB persist failed for {cache_key}: {e}")


def mark_stale_in_db(cache_key: str):
    """Mark a cache entry as stale in PostgreSQL."""
    try:
        conn = _get_db_conn()
        cur = conn.cursor()
        cur.execute("UPDATE market_cache SET is_stale = true, updated_at = NOW() WHERE cache_key = %s", (cache_key,))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"DB mark_stale failed for {cache_key}: {e}")


def persist_benchmark_data(data: dict, benchmark_name: str = "NIFTY50"):
    """Extract index close price from scraped data and insert into benchmark_data table.

    This feeds the calc_beta/calc_alpha/calc_tracking_error DB functions.
    The benchmark_data table schema: (benchmark_name, date, value) with UNIQUE(benchmark_name, date).
    """
    try:
        as_of = data.get("as_of", "")
        # as_of is ISO format like "2026-02-20T15:30:00+05:30" — extract date part
        if "T" in as_of:
            date_str = as_of.split("T")[0]
        else:
            date_str = as_of

        if not date_str:
            return

        # index_value is the index close price (e.g., NIFTY 50 = 22500.35)
        # extracted from NSE API response in scrape_index_movers()
        index_value = data.get("index_value")
        if not index_value:
            return

        conn = _get_db_conn()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO benchmark_data (benchmark_name, date, value)
            VALUES (%s, %s, %s)
            ON CONFLICT (benchmark_name, date) DO UPDATE SET
                value = EXCLUDED.value
            """,
            (benchmark_name, date_str, index_value),
        )
        conn.commit()
        cur.close()
        conn.close()
        logger.info(f"Persisted {benchmark_name} = {index_value} for {date_str}")
    except Exception as e:
        logger.error(f"Benchmark persist failed: {e}")


async def refresh_all():
    """Run all scrapers, update cache + DB. Called by APScheduler every 30 min."""
    scrapers = [
        ("nifty_constituents", scrape_nifty_constituents, "https://www.niftyindices.com/IndexConstituent/ind_nifty50list.csv"),
        ("fii_dii", scrape_fii_dii, "https://www.nseindia.com/api/fiidiiTradeReact"),
        ("index_movers_nifty", lambda: scrape_index_movers("NIFTY 50"), "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050"),
        ("index_movers_banknifty", lambda: scrape_index_movers("NIFTY BANK"), "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20BANK"),
    ]

    for cache_key, scraper_fn, source_url in scrapers:
        try:
            data = await scraper_fn()
            cache.set(cache_key, data, is_stale=False)
            persist_to_db(cache_key, data, source_url)
            logger.info(f"Refreshed {cache_key}")

            # Persist index close prices to benchmark_data for Alpha/Beta calculations
            if cache_key == "index_movers_nifty":
                persist_benchmark_data(data, "NIFTY50")
            elif cache_key == "index_movers_banknifty":
                persist_benchmark_data(data, "NIFTYBANK")
        except Exception as e:
            cache.mark_stale(cache_key)
            mark_stale_in_db(cache_key)
            logger.warning(f"Scrape failed for {cache_key}: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run initial scrape on startup, then schedule every SCRAPER_INTERVAL minutes."""
    logger.info(f"Starting scraper service (interval: {SCRAPER_INTERVAL}min)")
    # Initial scrape on boot
    await refresh_all()
    # Schedule recurring
    scheduler.add_job(refresh_all, "interval", minutes=SCRAPER_INTERVAL, id="market_state_refresh")
    scheduler.start()
    logger.info("APScheduler started")
    yield
    scheduler.shutdown()
    logger.info("Scraper service shutting down")


app = FastAPI(title="Akshaya Market Scraper", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ── Endpoints (all read from cache — zero external calls) ────────────

@app.get("/market-state")
async def get_market_state():
    """Full cache snapshot with staleness metadata."""
    all_data = cache.get_all()
    data_out = {}
    staleness_out = {}
    for key, entry in all_data.items():
        data_out[key] = entry["data"]
        staleness_out[key] = {"is_stale": entry["is_stale"], "last_updated": entry["last_updated"]}
    return {"success": True, "data": data_out, "staleness": staleness_out}


@app.get("/nifty-constituents")
async def get_nifty_constituents():
    data, is_stale, last_updated = cache.get("nifty_constituents")
    if data is None:
        return {"success": False, "error": "No data available yet", "is_stale": True}
    return {"success": True, "data": data, "is_stale": is_stale, "last_updated": last_updated}


@app.get("/fii-dii")
async def get_fii_dii():
    data, is_stale, last_updated = cache.get("fii_dii")
    if data is None:
        return {"success": False, "error": "No data available yet", "is_stale": True}
    return {"success": True, "data": data, "is_stale": is_stale, "last_updated": last_updated}


@app.get("/index-movers")
async def get_index_movers(index: str = "nifty"):
    cache_key = "index_movers_nifty" if "nifty" in index.lower() and "bank" not in index.lower() else "index_movers_banknifty"
    data, is_stale, last_updated = cache.get(cache_key)
    if data is None:
        return {"success": False, "error": "No data available yet", "is_stale": True}
    return {"success": True, "data": data, "is_stale": is_stale, "last_updated": last_updated}


@app.get("/health")
async def health_check():
    h = cache.health()
    return {"status": "ok", **h}


@app.post("/refresh")
async def manual_refresh():
    """Manual trigger for immediate refresh (for testing/admin)."""
    await refresh_all()
    return {"success": True, "message": "Refresh completed"}
