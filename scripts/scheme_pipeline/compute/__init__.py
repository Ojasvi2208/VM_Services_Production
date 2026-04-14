"""Pure-function compute steps. Each consumes DB state and writes derived rows.

Contract: each module exposes ``run() -> int`` returning rows written, and
uses IngestionLogger internally. Compute steps run AFTER adapters for a
given day.
"""
