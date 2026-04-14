"""psycopg2 connection pool + thin query helpers.

One pool per process. Callers use ``get_conn()`` as a context manager
so connections are always returned to the pool, even on exception.

All helpers use parameterised queries. Do not f-string SQL.
"""
from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Any, Iterable, Optional, Sequence

import psycopg2
from psycopg2 import pool as pg_pool
from psycopg2.extensions import connection as PGConnection
from psycopg2.extras import execute_values, RealDictCursor

from .config import ConfigError, settings

log = logging.getLogger(__name__)

_pool: Optional[pg_pool.SimpleConnectionPool] = None


def get_pool() -> pg_pool.SimpleConnectionPool:
    global _pool
    if _pool is None:
        if settings is None:
            raise ConfigError("DATABASE_URL not set; cannot open pool.")
        _pool = pg_pool.SimpleConnectionPool(
            settings.pool_min,
            settings.pool_max,
            dsn=settings.database_url,
        )
        log.info("db pool opened (min=%s max=%s)", settings.pool_min, settings.pool_max)
    return _pool


@contextmanager
def get_conn(commit: bool = True):
    """Yield a pooled connection. Commits on clean exit, rolls back on error."""
    p = get_pool()
    conn: PGConnection = p.getconn()
    try:
        yield conn
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        p.putconn(conn)


def fetch_all(sql: str, params: Sequence[Any] = ()) -> list[dict]:
    with get_conn(commit=False) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]


def fetch_one(sql: str, params: Sequence[Any] = ()) -> Optional[dict]:
    with get_conn(commit=False) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row else None


def execute_batch(sql: str, rows: Iterable[Sequence[Any]], page_size: int = 500) -> int:
    """Upsert-style batch. `sql` must contain a single ``VALUES %s`` placeholder."""
    rows = list(rows)
    if not rows:
        return 0
    with get_conn() as conn, conn.cursor() as cur:
        execute_values(cur, sql, rows, page_size=page_size)
        return cur.rowcount


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None
