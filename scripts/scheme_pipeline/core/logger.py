"""IngestionLogger — context manager that writes to ingestion_run.

Every ETL job wraps its work in IngestionLogger so GET /api/health/data
can answer 'when did each source last succeed and how many rows?'.

Usage:
    with IngestionLogger(source='amfi_nav', job_name='nav_daily') as run:
        rows = fetch_and_write()
        run.set_row_count(rows)
        run.meta({'file': 'NAVAll.txt'})
"""
from __future__ import annotations

import json
import logging
import traceback
from datetime import datetime
from typing import Any, Optional

from .db import get_conn

log = logging.getLogger(__name__)

_INSERT_RUN = """
    INSERT INTO ingestion_run (source, job_name, started_at, status)
    VALUES (%s, %s, %s, 'running')
    RETURNING id;
"""

_UPDATE_RUN = """
    UPDATE ingestion_run
    SET ended_at = %s,
        status = %s,
        row_count = %s,
        error_message = %s,
        metadata = %s
    WHERE id = %s;
"""


class IngestionLogger:
    def __init__(self, source: str, job_name: str) -> None:
        self.source = source
        self.job_name = job_name
        self.run_id: Optional[int] = None
        self._row_count: int = 0
        self._metadata: dict[str, Any] = {}
        self._status_override: Optional[str] = None

    def set_row_count(self, n: int) -> None:
        self._row_count = int(n)

    def meta(self, data: dict[str, Any]) -> None:
        self._metadata.update(data)

    def mark_partial(self) -> None:
        """Job completed but with recoverable errors."""
        self._status_override = "partial"

    def __enter__(self) -> "IngestionLogger":
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(_INSERT_RUN, (self.source, self.job_name, datetime.utcnow()))
            self.run_id = cur.fetchone()[0]
        log.info("[%s/%s] run_id=%s started", self.source, self.job_name, self.run_id)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        ended_at = datetime.utcnow()
        if exc_type is None:
            status = self._status_override or "success"
            error_message = None
        else:
            status = "failed"
            error_message = (
                f"{exc_type.__name__}: {exc_val}\n" + "".join(traceback.format_tb(exc_tb))
            )[:4000]
        try:
            with get_conn() as conn, conn.cursor() as cur:
                cur.execute(
                    _UPDATE_RUN,
                    (
                        ended_at,
                        status,
                        self._row_count,
                        error_message,
                        json.dumps(self._metadata) if self._metadata else None,
                        self.run_id,
                    ),
                )
        except Exception:
            log.exception("[%s/%s] failed to write ingestion_run terminal row", self.source, self.job_name)
        log.info(
            "[%s/%s] run_id=%s status=%s rows=%s",
            self.source, self.job_name, self.run_id, status, self._row_count,
        )
        # Never swallow exceptions — re-raise so the orchestrator sees failure.
        return False
