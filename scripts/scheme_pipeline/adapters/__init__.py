"""External data adapters. One module per source.

Contract: each adapter exposes ``run() -> int`` returning row count written,
and uses an ``IngestionLogger`` context manager internally.
"""
