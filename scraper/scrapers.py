"""
Zero-dependency NSE/NiftyIndices scrapers.
All free sources, no paid APIs. Session-aware with User-Agent rotation.
"""

import csv
import io
import logging
import random
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("scraper")

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
]


async def _get_nse_client() -> httpx.AsyncClient:
    """Create an httpx client with NSE session cookies."""
    ua = random.choice(USER_AGENTS)
    client = httpx.AsyncClient(
        timeout=20.0,
        follow_redirects=True,
        headers={
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate",
        },
    )
    # Fetch homepage to establish session cookies
    await client.get("https://www.nseindia.com")
    # Switch to JSON accept for API calls
    client.headers.update({
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.nseindia.com",
    })
    return client


# ── a) Nifty 50 Constituents & Sectoral Weights ──────────────────────

async def scrape_nifty_constituents() -> dict:
    """
    Primary: NSE equity-stockIndices API (has weights + prices).
    Fallback: NiftyIndices CSV (reliable but no weights).
    """
    try:
        return await _scrape_nifty_api()
    except Exception as e:
        logger.warning(f"NSE API scrape failed ({e}), trying CSV fallback")
        return await _scrape_nifty_csv()


async def _scrape_nifty_csv() -> dict:
    """Download and parse ind_nifty50list.csv from niftyindices.com."""
    ua = random.choice(USER_AGENTS)
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        resp = await client.get(
            "https://www.niftyindices.com/IndexConstituent/ind_nifty50list.csv",
            headers={"User-Agent": ua, "Accept": "text/csv,*/*"},
        )
        resp.raise_for_status()

    reader = csv.DictReader(io.StringIO(resp.text))
    constituents = []
    sector_weights: dict[str, float] = {}

    for row in reader:
        symbol = row.get("Symbol", "").strip()
        company = row.get("Company Name", "").strip()
        industry = row.get("Industry", "").strip()
        isin = row.get("ISIN Code", "").strip()
        weight_str = row.get("Weight(%)", row.get("Weight", "0")).strip()

        try:
            weight = float(weight_str)
        except ValueError:
            weight = 0.0

        if not symbol:
            continue

        constituents.append({
            "symbol": symbol,
            "company": company,
            "industry": industry,
            "weight": weight,
            "isin": isin,
        })
        sector_weights[industry] = sector_weights.get(industry, 0.0) + weight

    # Sort by weight descending
    constituents.sort(key=lambda x: x["weight"], reverse=True)
    sector_weights = dict(sorted(sector_weights.items(), key=lambda x: x[1], reverse=True))

    return {
        "as_of": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "constituents": constituents,
        "sector_weights": {k: round(v, 2) for k, v in sector_weights.items()},
    }


async def _scrape_nifty_api() -> dict:
    """Fallback: NSE equity-stockIndices API."""
    client = await _get_nse_client()
    try:
        resp = await client.get(
            "https://www.nseindia.com/api/equity-stockIndices",
            params={"index": "NIFTY 50"},
        )
        resp.raise_for_status()
        data = resp.json()
    finally:
        await client.aclose()

    # First pass: collect raw data and total ffmc for weight normalization
    raw_stocks = []
    total_ffmc = 0.0
    for stock in data.get("data", []):
        symbol = stock.get("symbol", "")
        if symbol == "NIFTY 50":
            continue
        meta = stock.get("meta", {}) if isinstance(stock.get("meta"), dict) else {}
        ffmc = stock.get("ffmc", 0.0)
        total_ffmc += ffmc
        raw_stocks.append((symbol, meta, ffmc))

    # Second pass: normalize weights to percentages
    constituents = []
    sector_weights: dict[str, float] = {}

    for symbol, meta, ffmc in raw_stocks:
        weight_pct = (ffmc / total_ffmc * 100.0) if total_ffmc > 0 else 0.0
        industry = meta.get("industry", "Unknown")

        constituents.append({
            "symbol": symbol,
            "company": meta.get("companyName", symbol),
            "industry": industry,
            "weight": round(weight_pct, 2),
            "isin": meta.get("isin", ""),
        })
        sector_weights[industry] = sector_weights.get(industry, 0.0) + weight_pct

    # Sort by weight descending
    constituents.sort(key=lambda x: x["weight"], reverse=True)
    sector_weights = dict(sorted(sector_weights.items(), key=lambda x: x[1], reverse=True))

    return {
        "as_of": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "constituents": constituents,
        "sector_weights": {k: round(v, 2) for k, v in sector_weights.items()},
    }


# ── b) FII/DII Net Activity ──────────────────────────────────────────

async def scrape_fii_dii() -> dict:
    """Scrape FII/DII provisional trading data from NSE."""
    client = await _get_nse_client()
    try:
        resp = await client.get("https://www.nseindia.com/api/fiidiiTradeReact")
        resp.raise_for_status()
        data = resp.json()
    finally:
        await client.aclose()

    fii = {"buy_value": 0.0, "sell_value": 0.0, "net_value": 0.0}
    dii = {"buy_value": 0.0, "sell_value": 0.0, "net_value": 0.0}
    trade_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    for entry in data:
        category = entry.get("category", "")
        buy_val = _parse_num(entry.get("buyValue", "0"))
        sell_val = _parse_num(entry.get("sellValue", "0"))
        net_val = _parse_num(entry.get("netValue", "0"))
        date_str = entry.get("date", "")

        if date_str:
            trade_date = date_str

        if "FII" in category.upper() or "FPI" in category.upper():
            fii["buy_value"] += buy_val
            fii["sell_value"] += sell_val
            fii["net_value"] += net_val
        elif "DII" in category.upper():
            dii["buy_value"] += buy_val
            dii["sell_value"] += sell_val
            dii["net_value"] += net_val

    return {
        "date": trade_date,
        "fii": {k: round(v, 2) for k, v in fii.items()},
        "dii": {k: round(v, 2) for k, v in dii.items()},
    }


# ── c) Live Index Movers ─────────────────────────────────────────────

async def scrape_index_movers(index_name: str = "NIFTY 50") -> dict:
    """
    Fetch all stocks in the index, calculate contribution = weight × pChange,
    return top 5 gainers + top 5 losers.
    """
    client = await _get_nse_client()
    try:
        resp = await client.get(
            "https://www.nseindia.com/api/equity-stockIndices",
            params={"index": index_name},
        )
        resp.raise_for_status()
        data = resp.json()
    finally:
        await client.aclose()

    # First pass: collect raw data and compute total ffmc for weight normalization
    raw_stocks = []
    total_ffmc = 0.0
    index_value = 0.0  # The index close price (e.g., NIFTY 50 = 22500.35)
    for stock in data.get("data", []):
        symbol = stock.get("symbol", "")
        if symbol == index_name:
            index_value = stock.get("lastPrice", 0.0)
            continue

        p_change = stock.get("pChange", 0.0)
        ffmc = stock.get("ffmc", 0.0)
        last_price = stock.get("lastPrice", 0.0)
        total_ffmc += ffmc
        raw_stocks.append((symbol, p_change, ffmc, last_price))

    # Second pass: normalize weights to percentages, compute contribution
    stocks = []
    for symbol, p_change, ffmc, last_price in raw_stocks:
        weight_pct = (ffmc / total_ffmc * 100.0) if total_ffmc > 0 else 0.0
        # Contribution = weight% × pChange% / 100 (index points approximation)
        contribution = weight_pct * p_change / 100.0

        stocks.append({
            "symbol": symbol,
            "change_pct": round(p_change, 2),
            "weight": round(weight_pct, 2),
            "contribution": round(contribution, 4),
            "last_price": round(last_price, 2),
        })

    # Split into gainers (positive contribution) and losers (negative contribution)
    gainers = [s for s in stocks if s["contribution"] > 0]
    losers = [s for s in stocks if s["contribution"] < 0]
    gainers.sort(key=lambda x: x["contribution"], reverse=True)
    losers.sort(key=lambda x: x["contribution"])
    top_gainers = gainers[:5]
    top_losers = losers[:5]

    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "index_name": index_name,
        "index_value": round(index_value, 2),
        "top_gainers": top_gainers,
        "top_losers": top_losers,
    }


# ── Helpers ───────────────────────────────────────────────────────────

def _parse_num(val: str | int | float) -> float:
    """Parse numeric value, stripping commas and handling strings."""
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0
