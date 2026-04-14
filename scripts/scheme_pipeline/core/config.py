"""Environment-driven configuration. Fails fast at import time."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


class ConfigError(RuntimeError):
    """Raised when required environment is missing or malformed."""


def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ConfigError(
            f"Missing required env var: {name}. "
            "See vijaymalik-financial/.env.example for the full list."
        )
    return value


def _optional(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


@dataclass(frozen=True)
class Settings:
    database_url: str
    amfi_nav_url: str
    amfi_dividends_url: str
    benchmark_tri_url: str
    pipeline_log_level: str
    pool_min: int
    pool_max: int

    @classmethod
    def load(cls) -> "Settings":
        return cls(
            database_url=_require("DATABASE_URL"),
            amfi_nav_url=_optional(
                "PIPELINE_AMFI_NAV_URL",
                "https://portal.amfiindia.com/spages/NAVAll.txt",
            ),
            amfi_dividends_url=_optional(
                "PIPELINE_AMFI_DIVIDENDS_URL",
                "https://portal.amfiindia.com/DownloadRADividendHistoryReport_Po.aspx",
            ),
            benchmark_tri_url=_optional(
                "PIPELINE_BENCHMARK_TRI_URL",
                "https://www.niftyindices.com/IndexConstituent/TRI",
            ),
            pipeline_log_level=_optional("PIPELINE_LOG_LEVEL", "INFO"),
            pool_min=int(_optional("PIPELINE_POOL_MIN", "1")),
            pool_max=int(_optional("PIPELINE_POOL_MAX", "4")),
        )


# Module-level singleton; raises immediately if DATABASE_URL is missing.
try:
    settings: Optional[Settings] = Settings.load()
except ConfigError:
    # Allow tooling (autocomplete, tests) to import the module without env.
    # Callers that actually hit the DB will receive a clear error.
    settings = None
