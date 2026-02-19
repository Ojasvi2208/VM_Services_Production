"""
Singleton MarketStateCache — in-memory dict with timestamps and staleness flags.
All user requests read from this cache. Zero external calls on user-triggered events.
Background worker (APScheduler) is the only writer.
"""

from datetime import datetime, timezone
from typing import Any


class MarketStateCache:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._data: dict[str, Any] = {}
            cls._instance._timestamps: dict[str, datetime] = {}
            cls._instance._staleness: dict[str, bool] = {}
        return cls._instance

    def get(self, key: str) -> tuple[Any | None, bool, str | None]:
        """Returns (data, is_stale, last_updated_iso)."""
        data = self._data.get(key)
        ts = self._timestamps.get(key)
        is_stale = self._staleness.get(key, True)
        return data, is_stale, ts.isoformat() if ts else None

    def set(self, key: str, data: Any, is_stale: bool = False):
        self._data[key] = data
        self._timestamps[key] = datetime.now(timezone.utc)
        self._staleness[key] = is_stale

    def mark_stale(self, key: str):
        self._staleness[key] = True

    def get_all(self) -> dict:
        """Full cache snapshot for /market-state endpoint."""
        result: dict[str, Any] = {}
        for key in self._data:
            data, is_stale, last_updated = self.get(key)
            result[key] = {
                "data": data,
                "is_stale": is_stale,
                "last_updated": last_updated,
            }
        return result

    def health(self) -> dict:
        """Cache health for /health endpoint."""
        entries = {}
        for key in self._data:
            ts = self._timestamps.get(key)
            entries[key] = {
                "is_stale": self._staleness.get(key, True),
                "last_updated": ts.isoformat() if ts else None,
                "age_seconds": (datetime.now(timezone.utc) - ts).total_seconds() if ts else None,
            }
        return {"cache_entries": len(self._data), "details": entries}
