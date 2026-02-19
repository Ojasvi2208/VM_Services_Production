"""Pydantic response models for the scraper API."""

from pydantic import BaseModel


class TradeData(BaseModel):
    buy_value: float
    sell_value: float
    net_value: float


class FiiDiiData(BaseModel):
    date: str
    fii: TradeData
    dii: TradeData


class NiftyConstituent(BaseModel):
    symbol: str
    company: str
    industry: str
    weight: float
    isin: str = ""


class NiftyConstituentsData(BaseModel):
    as_of: str
    constituents: list[NiftyConstituent]
    sector_weights: dict[str, float]


class IndexMover(BaseModel):
    symbol: str
    change_pct: float
    weight: float
    contribution: float
    last_price: float


class IndexMoversData(BaseModel):
    as_of: str
    index_name: str
    top_gainers: list[IndexMover]
    top_losers: list[IndexMover]


class StalenessInfo(BaseModel):
    is_stale: bool
    last_updated: str | None


class MarketStateResponse(BaseModel):
    success: bool = True
    data: dict
    staleness: dict[str, StalenessInfo]


class HealthResponse(BaseModel):
    status: str = "ok"
    cache_entries: int
    details: dict
