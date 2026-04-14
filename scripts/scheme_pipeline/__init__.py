"""scheme_pipeline — Python ETL for mutual fund scheme data.

Entry points:
  python -m scheme_pipeline.jobs.daily_etl
  python -m scheme_pipeline.jobs.daily_etl --only nav

Writes every run to the ``ingestion_run`` table (migration 024)
for consumption by GET /api/health/data.
"""

__version__ = "0.1.0"
