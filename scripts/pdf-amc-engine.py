"""
PDF AMC Factsheet Engine — "The Iterative AMC PDF Engine"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Strategy Design Pattern for parsing mutual fund factsheet PDFs.
Each AMC has a concrete parser that extends BaseAMCParser.
Vision LLM fallback for scrambled/unreadable pages.

Architecture:
  BaseAMCParser (abstract)
    ├── KotakParser
    ├── HDFCParser
    ├── ICICIParser
    ├── EdelweissParser
    └── ... (add new AMCs by subclassing)

  ParserFactory (auto-registry via __init_subclass__)
  VisionLLM fallback (Gemini 1.5 Flash / Claude 3.5 Sonnet)

Usage:
  python3 scripts/pdf-amc-engine.py <pdf_path_or_directory>
  python3 scripts/pdf-amc-engine.py <pdf_path> --amc kotak
  python3 scripts/pdf-amc-engine.py <directory> --dry-run
"""

from __future__ import annotations

import abc
import base64
import json
import logging
import os
import re
import sys
from dataclasses import dataclass, field, asdict
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
import pdfplumber
import psycopg2
from psycopg2.extras import execute_values

# ═══════════════════════════════════════════════════════════════
#  LOGGING
# ═══════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-7s │ %(name)-18s │ %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("pdf-engine")

# ═══════════════════════════════════════════════════════════════
#  CONFIG
# ═══════════════════════════════════════════════════════════════

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway",
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
VISION_LLM_PROVIDER = os.environ.get("VISION_LLM_PROVIDER", "gemini")  # "gemini" or "claude"

# ═══════════════════════════════════════════════════════════════
#  DATA MODEL
# ═══════════════════════════════════════════════════════════════

@dataclass
class Holding:
    """Single stock/instrument holding within a fund."""
    stock_name: str
    weight_pct: float
    sector: str = ""
    isin: str = ""
    scheme_code: str = ""

    def is_valid(self) -> bool:
        return (
            bool(self.stock_name.strip())
            and 0 < self.weight_pct <= 100
            and len(self.stock_name) > 2
        )


@dataclass
class FundPage:
    """Parsed output for a single fund from the factsheet."""
    fund_name: str
    holdings: list[Holding] = field(default_factory=list)
    page_numbers: list[int] = field(default_factory=list)
    aum_cr: Optional[float] = None
    inception_date: Optional[str] = None
    benchmark: Optional[str] = None
    category: Optional[str] = None
    expense_ratio_regular: Optional[float] = None
    expense_ratio_direct: Optional[float] = None
    beta: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    std_deviation: Optional[float] = None
    pe_ratio: Optional[float] = None
    pb_ratio: Optional[float] = None
    portfolio_turnover: Optional[float] = None
    large_cap_pct: Optional[float] = None
    mid_cap_pct: Optional[float] = None
    small_cap_pct: Optional[float] = None
    source: str = "pdfplumber"  # "pdfplumber" or "vision_llm"

    @property
    def equity_total(self) -> float:
        return sum(h.weight_pct for h in self.holdings)

    @property
    def holding_count(self) -> int:
        return len(self.holdings)


# ═══════════════════════════════════════════════════════════════
#  SECTOR NORMALIZATION (reuse from universal-amc-parser)
# ═══════════════════════════════════════════════════════════════

SECTOR_ALIAS_MAP: dict[str, int] = {}
MASTER_SECTORS: dict[int, str] = {}

RATING_PATTERN = re.compile(
    r"^(CRISIL|CARE|FITCH|ICRA|IND|ACUITE|BWR|SOV|\[ICRA\])",
    re.IGNORECASE,
)

def load_sector_aliases(conn) -> None:
    """Load sector alias mapping from DB."""
    global SECTOR_ALIAS_MAP, MASTER_SECTORS
    cur = conn.cursor()
    cur.execute("SELECT id, sector_name FROM master_sectors")
    for row in cur.fetchall():
        MASTER_SECTORS[row[0]] = row[1]
    cur.execute("SELECT LOWER(raw_sector), master_sector_id FROM sector_aliases")
    for row in cur.fetchall():
        SECTOR_ALIAS_MAP[row[0]] = row[1]
    log.info(f"Loaded {len(SECTOR_ALIAS_MAP)} sector aliases, {len(MASTER_SECTORS)} master sectors")


def normalize_sector(raw: str) -> tuple[Optional[int], str]:
    """Return (master_sector_id, master_sector_name) or (None, raw)."""
    if not raw or RATING_PATTERN.match(raw):
        return None, raw
    key = raw.strip().lower()
    mid = SECTOR_ALIAS_MAP.get(key)
    if mid:
        return mid, MASTER_SECTORS.get(mid, raw)
    # Fuzzy: try stripping trailing "s", "sector", common suffixes
    for suffix in ["s", " sector", " industry", " services", " products"]:
        trimmed = key.rstrip(suffix) if key.endswith(suffix) else None
        if trimmed and trimmed in SECTOR_ALIAS_MAP:
            mid = SECTOR_ALIAS_MAP[trimmed]
            return mid, MASTER_SECTORS.get(mid, raw)
    return None, raw


# ═══════════════════════════════════════════════════════════════
#  BASE STRATEGY (Abstract)
# ═══════════════════════════════════════════════════════════════

class BaseAMCParser(abc.ABC):
    """
    Abstract base class for AMC-specific PDF parsers.
    Uses Strategy Design Pattern — each AMC overrides extraction logic.

    Auto-registers subclasses via __init_subclass__ for ParserFactory.
    """

    # Subclass must set this (e.g., "kotak", "hdfc")
    AMC_KEY: str = ""

    # Registry populated by __init_subclass__
    _registry: dict[str, type[BaseAMCParser]] = {}

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if cls.AMC_KEY:
            BaseAMCParser._registry[cls.AMC_KEY.lower()] = cls
            log.debug(f"Registered parser: {cls.AMC_KEY} → {cls.__name__}")

    def __init__(self, pdf_path: str):
        self.pdf_path = Path(pdf_path)
        if not self.pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")
        self.pdf_plumber = pdfplumber.open(str(self.pdf_path))
        self.pdf_fitz = fitz.open(str(self.pdf_path))
        self.total_pages = len(self.pdf_plumber.pages)
        log.info(f"Opened {self.pdf_path.name}: {self.total_pages} pages")

    def close(self):
        self.pdf_plumber.close()
        self.pdf_fitz.close()

    # ─── Abstract methods ───────────────────────────────────────

    @abc.abstractmethod
    def identify_fund_pages(self) -> list[tuple[str, list[int]]]:
        """
        Scan PDF and return [(fund_name, [page_numbers]), ...].
        Each AMC structures its factsheet differently.
        Must be time-agnostic — use text anchors, not dates.
        """
        ...

    @abc.abstractmethod
    def extract_holdings_from_page(self, page_idx: int) -> list[Holding]:
        """
        Extract stock holdings from a single page using pdfplumber.
        Returns raw holdings before normalization.
        """
        ...

    # ─── Optional overrides ─────────────────────────────────────

    def extract_fund_metadata(self, page_idx: int) -> dict:
        """
        Extract AUM, inception date, benchmark, expense ratio, ratios, etc.
        Override per AMC if layout differs.
        """
        return {}

    # ─── Shared helpers ─────────────────────────────────────────

    def get_page_text(self, page_idx: int) -> str:
        """Get full text of a page."""
        page = self.pdf_plumber.pages[page_idx]
        return page.extract_text() or ""

    def get_page_words(self, page_idx: int) -> list[dict]:
        """Get word-level data with positions."""
        return self.pdf_plumber.pages[page_idx].extract_words()

    def get_words_grouped_by_line(self, page_idx: int, y_tolerance: float = 3.0) -> dict[float, list[tuple[float, str]]]:
        """
        Group words by Y-position into lines.
        Returns {y_pos: [(x_pos, text), ...]} sorted by x within each line.
        """
        words = self.get_page_words(page_idx)
        lines: dict[float, list[tuple[float, str]]] = {}
        for w in words:
            # Round Y to group words on same line
            y = round(w["top"] / y_tolerance) * y_tolerance
            if y not in lines:
                lines[y] = []
            lines[y].append((w["x0"], w["text"]))
        # Sort words within each line by x-position
        for y in lines:
            lines[y].sort(key=lambda t: t[0])
        return lines

    def extract_percentage(self, text: str) -> Optional[float]:
        """Extract a percentage value from text like '7.36%' or '7.36'."""
        m = re.search(r"(\d{1,3}\.\d{1,2})%?", text)
        if m:
            val = float(m.group(1))
            if 0 < val <= 100:
                return val
        return None

    def page_to_image_base64(self, page_idx: int, dpi: int = 200) -> str:
        """Convert a PDF page to base64 PNG using PyMuPDF."""
        page = self.pdf_fitz[page_idx]
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("png")
        return base64.b64encode(img_bytes).decode("utf-8")

    # ─── Vision LLM Fallback ────────────────────────────────────

    def fallback_vision_extract(self, page_indices: list[int]) -> list[Holding]:
        """
        When pdfplumber fails, convert pages to images and send to
        a Vision LLM (Gemini 1.5 Flash or Claude 3.5 Sonnet) for extraction.

        Stateless API call — no model weights on server.
        """
        if not GEMINI_API_KEY and VISION_LLM_PROVIDER == "gemini":
            log.warning("No GEMINI_API_KEY set — vision fallback unavailable")
            return []

        images_b64 = []
        for idx in page_indices:
            log.info(f"  Converting page {idx} to image for vision LLM...")
            images_b64.append(self.page_to_image_base64(idx))

        prompt = """You are a financial data extraction engine. Extract ALL stock/instrument holdings
from this mutual fund factsheet page.

Return ONLY valid JSON array, no markdown, no explanation:
[
  {"stock_name": "HDFC Bank Ltd.", "weight_pct": 7.36, "sector": "Banks"},
  {"stock_name": "Reliance Industries Ltd.", "weight_pct": 6.39, "sector": "Petroleum Products"}
]

RULES:
1. Extract EVERY equity holding with its percentage weight (% to Net Assets / % to NAV).
2. Include the sector/industry if visible next to the stock.
3. Skip headers, totals, sub-totals, debt instruments, mutual fund units, futures, TREPS, CBLO.
4. Stock names must be exact as printed. Do NOT abbreviate or modify.
5. weight_pct must be a number (not string), already in percentage form (e.g., 7.36 not 0.0736).
6. If a sector header has no individual stock under it, skip it.
7. Return empty array [] if no holdings found."""

        if VISION_LLM_PROVIDER == "gemini":
            return self._call_gemini_vision(images_b64, prompt)
        else:
            return self._call_claude_vision(images_b64, prompt)

    def _call_gemini_vision(self, images_b64: list[str], prompt: str) -> list[Holding]:
        """Call Gemini 1.5 Flash with page images."""
        import urllib.request
        import urllib.error

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"

        parts = [{"text": prompt}]
        for img in images_b64:
            parts.append({
                "inline_data": {
                    "mime_type": "image/png",
                    "data": img,
                }
            })

        payload = json.dumps({
            "contents": [{"parts": parts}],
            "generationConfig": {
                "temperature": 0.1,
                "topK": 1,
                "topP": 0.95,
                "maxOutputTokens": 4096,
                "responseMimeType": "application/json",
            },
        }).encode("utf-8")

        req = urllib.request.Request(url, data=payload, method="POST")
        req.add_header("Content-Type", "application/json")

        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = json.loads(resp.read().decode())
                text = body["candidates"][0]["content"]["parts"][0]["text"]
                holdings_raw = json.loads(text)
                holdings = []
                for h in holdings_raw:
                    holding = Holding(
                        stock_name=h.get("stock_name", ""),
                        weight_pct=float(h.get("weight_pct", 0)),
                        sector=h.get("sector", ""),
                    )
                    if holding.is_valid():
                        holdings.append(holding)
                log.info(f"  Vision LLM extracted {len(holdings)} holdings")
                return holdings
        except (urllib.error.URLError, json.JSONDecodeError, KeyError) as e:
            log.error(f"  Vision LLM call failed: {e}")
            return []

    def _call_claude_vision(self, images_b64: list[str], prompt: str) -> list[Holding]:
        """Call Claude 3.5 Sonnet with page images (placeholder for Anthropic API)."""
        log.warning("Claude vision fallback not yet configured — returning empty")
        return []

    # ─── Main extraction pipeline ───────────────────────────────

    def parse(self) -> list[FundPage]:
        """
        Full extraction pipeline:
        1. Identify fund pages (AMC-specific)
        2. For each fund, extract holdings via pdfplumber
        3. If pdfplumber yields < 5 holdings, try vision LLM fallback
        4. Extract metadata (AUM, ratios, etc.)
        5. Normalize sectors
        """
        fund_pages = self.identify_fund_pages()
        log.info(f"Identified {len(fund_pages)} funds in {self.pdf_path.name}")

        results: list[FundPage] = []

        for fund_name, pages in fund_pages:
            log.info(f"  Parsing: {fund_name} (pages {pages})")

            # Collect holdings from all pages of this fund
            all_holdings: list[Holding] = []
            source = "pdfplumber"

            for pg in pages:
                holdings = self.extract_holdings_from_page(pg)
                all_holdings.extend(holdings)

            # Fallback: if too few holdings, try vision LLM
            if len(all_holdings) < 5:
                log.warning(f"  Only {len(all_holdings)} holdings from pdfplumber — trying vision LLM")
                vision_holdings = self.fallback_vision_extract(pages)
                if len(vision_holdings) > len(all_holdings):
                    all_holdings = vision_holdings
                    source = "vision_llm"

            # Deduplicate by stock name (keep higher weight)
            seen: dict[str, Holding] = {}
            for h in all_holdings:
                key = h.stock_name.strip().upper()
                if key not in seen or h.weight_pct > seen[key].weight_pct:
                    seen[key] = h
            all_holdings = list(seen.values())

            # Sort by weight descending
            all_holdings.sort(key=lambda h: h.weight_pct, reverse=True)

            # Extract metadata from first page
            metadata = self.extract_fund_metadata(pages[0])

            fund_page = FundPage(
                fund_name=fund_name,
                holdings=all_holdings,
                page_numbers=pages,
                source=source,
                **metadata,
            )

            log.info(f"    → {fund_page.holding_count} holdings, equity total: {fund_page.equity_total:.1f}%")
            results.append(fund_page)

        self.close()
        return results


# ═══════════════════════════════════════════════════════════════
#  PARSER FACTORY
# ═══════════════════════════════════════════════════════════════

class ParserFactory:
    """
    Dynamic factory that routes AMC name → correct parser class.
    Auto-populated via BaseAMCParser.__init_subclass__.
    Adding a new AMC = adding a new class. Zero factory modifications.
    """

    @staticmethod
    def get_parser(amc_name: str, pdf_path: str) -> BaseAMCParser:
        key = amc_name.strip().lower()
        cls = BaseAMCParser._registry.get(key)
        if not cls:
            available = ", ".join(sorted(BaseAMCParser._registry.keys()))
            raise ValueError(f"No parser registered for AMC '{amc_name}'. Available: {available}")
        return cls(pdf_path)

    @staticmethod
    def detect_amc(pdf_path: str) -> Optional[str]:
        """
        Auto-detect AMC from PDF content by scanning first 5 pages.
        Uses text anchors — time-agnostic, no date dependence.
        """
        try:
            pdf = pdfplumber.open(pdf_path)
        except Exception as e:
            log.error(f"Cannot open PDF for detection: {e}")
            return None

        full_text = ""
        for i in range(min(5, len(pdf.pages))):
            full_text += (pdf.pages[i].extract_text() or "") + "\n"
        pdf.close()

        text_upper = full_text.upper()

        # Detection rules — order matters (most specific first)
        detection_rules: list[tuple[str, list[str]]] = [
            ("kotak", ["KOTAK MUTUAL FUND", "KOTAK MAHINDRA MUTUAL FUND", "KOTAK ASSET MANAGEMENT", "KOTAKMF.COM"]),
            ("hdfc", ["HDFC MUTUAL FUND", "HDFC ASSET MANAGEMENT", "HDFCFUND.COM"]),
            ("icici", ["ICICI PRUDENTIAL", "ICICI MUTUAL FUND", "ICICIPRUAMC.COM"]),
            ("edelweiss", ["EDELWEISS MUTUAL FUND", "EDELWEISS ASSET MANAGEMENT", "EDELWEISSMF.COM"]),
            ("sbi", ["SBI MUTUAL FUND", "SBI FUNDS MANAGEMENT", "SBIMF.COM"]),
            ("axis", ["AXIS MUTUAL FUND", "AXIS ASSET MANAGEMENT", "AXISMF.COM"]),
            ("nippon", ["NIPPON INDIA MUTUAL FUND", "NIPPON LIFE", "NIPPONINDIAMF.COM"]),
            ("tata", ["TATA MUTUAL FUND", "TATA ASSET MANAGEMENT", "TATAMUTUALFUND.COM"]),
            ("dsp", ["DSP MUTUAL FUND", "DSP INVESTMENT", "DSPIM.COM"]),
            ("aditya_birla", ["ADITYA BIRLA SUN LIFE", "ABSLI MUTUAL FUND", "BIRLAMF", "BIRLASULIFEAMC"]),
            ("motilal", ["MOTILAL OSWAL", "MOTILALOSWAL"]),
            ("mirae", ["MIRAE ASSET", "MABORAEASSETMF"]),
            ("parag_parikh", ["PPFAS", "PARAG PARIKH"]),
            ("quantum", ["QUANTUM MUTUAL FUND", "QUANTUMMF"]),
            ("canara", ["CANARA ROBECO", "CANARAROBECO"]),
            ("invesco", ["INVESCO INDIA", "INVESCOMUTUALFUND"]),
            ("sundaram", ["SUNDARAM MUTUAL FUND", "SUNDARAMMUTUALFUND"]),
            ("franklin", ["FRANKLIN TEMPLETON", "FRANKLINTEMPLETONINDIA"]),
            ("bandhan", ["BANDHAN MUTUAL FUND", "BANDHANMF"]),
            ("baroda", ["BARODA BNP PARIBAS", "BARODABNPPARIBASMF"]),
            ("hsbc", ["HSBC MUTUAL FUND", "HSBCMF"]),
            ("uti", ["UTI MUTUAL FUND", "UTIMF"]),
            ("mahindra", ["MAHINDRA MANULIFE", "MAHINDRAMANULIFE"]),
            ("pgim", ["PGIM INDIA", "PGIMINDIA"]),
            ("union", ["UNION MUTUAL FUND", "UNIONMF"]),
            ("lic", ["LIC MUTUAL FUND", "LICMF"]),
            ("groww", ["GROWW MUTUAL FUND", "GROWWMF"]),
            ("jm", ["JM FINANCIAL", "JMFINANCIALMF"]),
            ("quant", ["QUANT MUTUAL FUND", "QUANTMF.COM", "QUANT MONEY MANAGERS"]),
            ("samco", ["SAMCO MUTUAL FUND", "SAMCOMF"]),
            ("trust", ["TRUST MUTUAL FUND", "TRUSTMF"]),
            ("shriram", ["SHRIRAM MUTUAL FUND", "SHRIRAMAMC"]),
            ("navi", ["NAVI MUTUAL FUND", "NAVIMF"]),
            ("helios", ["HELIOS MUTUAL FUND", "HELIOSMF"]),
            ("white_oak", ["WHITE OAK", "WHITEOAKMF"]),
            ("old_bridge", ["OLD BRIDGE", "OLDBRIDGEMF"]),
            ("360_one", ["360 ONE", "THREESIXTY ONE", "360ONE"]),
            ("bajaj", ["BAJAJ FINSERV MUTUAL FUND", "BAJAJFINSERVMF"]),
            ("zerodha", ["ZERODHA FUND HOUSE", "ZERODHAFUND"]),
            ("whiteoak", ["WHITEOAK CAPITAL", "WHITEOAKCAPITAL"]),
            ("itif", ["ITI MUTUAL FUND", "ITIMF"]),
            ("taurus", ["TAURUS MUTUAL FUND", "TAURUSMF"]),
        ]

        for amc_key, anchors in detection_rules:
            for anchor in anchors:
                if anchor in text_upper:
                    log.info(f"Auto-detected AMC: {amc_key} (matched: '{anchor}')")
                    return amc_key

        log.warning("Could not auto-detect AMC from PDF content")
        return None

    @staticmethod
    def list_parsers() -> list[str]:
        return sorted(BaseAMCParser._registry.keys())


# ═══════════════════════════════════════════════════════════════
#  SHARED REGEX PATTERNS
# ═══════════════════════════════════════════════════════════════

# Matches "Stock Name 7.36" or "STOCK NAME LTD. 7.36%" at end of line
RE_HOLDING_LINE = re.compile(
    r"^(.+?)\s+(\d{1,3}\.\d{1,2})%?\s*$"
)

# Matches sector headers like "Banks 24.25" or "IT - Software 7.40"
RE_SECTOR_HEADER = re.compile(
    r"^([A-Z][A-Za-z &\-/]+(?:\s[A-Z][A-Za-z &\-/]+)*)\s+(\d{1,3}\.\d{1,2})%?\s*$"
)

# Skip patterns — non-holding lines
SKIP_PATTERNS = [
    re.compile(r"(Grand Total|Sub Total|Net Current|Triparty Repo|TREPS|CBLO|Treasury Bill)", re.I),
    re.compile(r"(Mutual Fund Units|Futures|Cash & Equivalents|Cash Margin|Reverse Repo)", re.I),
    re.compile(r"(Equity & Equity related|Debt & Debt Related|Money Market|Securitised)", re.I),
    re.compile(r"^\s*(Total|TOTAL)\s"),
    re.compile(r"(Benchmark|SEBI\b|Riskometer|\bSIP\b|\bNAV\b|\bAUM\b|\bAAUM\b|\bTRI\b)", re.I),
    re.compile(r"GOI \d{4}"),  # Government bonds like "7.38 GOI 2027"
    re.compile(r"(Regular Plan|Direct Plan|Growth Option|IDCW)", re.I),
    re.compile(r"^(Entry Load|Exit Load|Minimum|Folio Count|Allotment Date)", re.I),
]

# Common sector names (used to distinguish sector headers from stock names)
KNOWN_SECTORS = {
    "banks", "petroleum products", "it - software", "finance", "automobiles",
    "construction", "auto components", "telecom - services",
    "pharmaceuticals and biotechnology", "pharmaceuticals & biotechnology",
    "diversified fmcg", "power", "cement and cement products",
    "cement & cement products", "retailing", "ferrous metals",
    "non - ferrous metals", "non-ferrous metals", "transport services",
    "aerospace and defense", "aerospace & defense", "chemicals and petrochemicals",
    "chemicals & petrochemicals", "industrial products", "consumer durables",
    "fertilizers and agrochemicals", "fertilizers & agrochemicals",
    "personal products", "beverages", "food products", "healthcare services",
    "insurance", "realty", "consumable fuels", "capital markets",
    "electrical equipment", "textiles", "media & entertainment",
    "leisure services", "oil", "agricultural",
    "construction materials", "consumer services", "financial services",
    "information technology", "it - services", "it software", "it - software",
    "automobile and auto components", "automobile & auto components",
    "oil, gas & consumable fuels", "sovereign", "commercial services",
    "agricultural, commercial & construction vehicles", "auto components",
    "cement & cement products", "diversified", "ferrous metals & mining",
    "food, beverages & tobacco", "gas", "industrial manufacturing",
    "it - services", "miscellaneous", "paper", "preference shares",
    "telecom - equipment & accessories", "textile products", "transport logistics",
    "healthcare", "consumer staples", "communication services", "materials",
    "utilities", "energy", "real estate", "industrials",
    "consumer discretionary", "health care",
}


def is_sector_header(text: str) -> bool:
    """Check if a text line is a sector header (not a stock name)."""
    return text.strip().lower() in KNOWN_SECTORS


def should_skip_line(text: str) -> bool:
    """Check if line should be skipped (headers, totals, metadata)."""
    for pat in SKIP_PATTERNS:
        if pat.search(text):
            return True
    return False


# ═══════════════════════════════════════════════════════════════
#  AMC #1: KOTAK PARSER
# ═══════════════════════════════════════════════════════════════

class KotakParser(BaseAMCParser):
    """
    Kotak Mutual Fund factsheet parser.

    Layout: Single page per fund. Two-column portfolio section with:
      Left column:  names at x ≈ 157-340, weights at x ≈ 342-346
      Right column: names at x ≈ 367-550, weights at x ≈ 555-556
      Sidebar metadata (AUM, NAV, ratios): x < 140 — IGNORED

    Uses word-level spatial analysis for precision extraction.
    Time-agnostic: text anchors only, no date dependence.
    """

    AMC_KEY = "kotak"

    # Geometric constants (from word position analysis)
    SIDEBAR_MAX_X = 140      # Anything left of this is sidebar metadata
    LEFT_NAME_MIN_X = 150    # Left column stock names start here
    LEFT_WEIGHT_MIN_X = 330  # Left column weights at x ≈ 342-346
    LEFT_WEIGHT_MAX_X = 360
    RIGHT_NAME_MIN_X = 360   # Right column stock names start here
    RIGHT_WEIGHT_MIN_X = 545 # Right column weights at x ≈ 555-556
    RIGHT_WEIGHT_MAX_X = 570
    HOLDINGS_STOP_Y = 450    # Stop before sector allocation chart area

    def identify_fund_pages(self) -> list[tuple[str, list[int]]]:
        """
        Kotak: Each equity fund is on a single page.
        Identified by "PORTFOLIO" + "Issuer/Instrument" + "% to Net Assets" anchors.
        Skip ETF, Index, FoF pages.
        """
        funds: list[tuple[str, list[int]]] = []

        for i in range(self.total_pages):
            text = self.get_page_text(i)
            if not text:
                continue

            # Must have portfolio section with holdings table header
            if "Issuer/Instrument" not in text:
                continue
            if "% to Net Assets" not in text:
                continue

            # Skip non-equity fund types
            upper = text.upper()
            if any(skip in upper for skip in ["ETF", "INDEX FUND", "FUND OF FUND"]):
                continue

            fund_name = self._extract_kotak_fund_name(text)
            if fund_name:
                funds.append((fund_name, [i]))

        return funds

    def _extract_kotak_fund_name(self, text: str) -> Optional[str]:
        """Extract Kotak fund name from page text using 'KOTAK ... FUND' pattern."""
        # Match the full fund name line
        match = re.search(r"(KOTAK\s+[A-Z &\-]+(?:FUND|SCHEME))", text.upper())
        if match:
            name = match.group(1).strip()
            # Title case it
            name = name.title()
            # Fix common title-case issues
            name = name.replace(" And ", " and ").replace(" & ", " & ").replace(" Of ", " of ")
            if len(name) > 5:
                return name
        return None

    def extract_holdings_from_page(self, page_idx: int) -> list[Holding]:
        """
        Extract holdings using word-level position analysis.
        Groups words by Y-line, splits into left/right columns by X,
        and pairs stock names with their weight values at known X positions.
        """
        words = self.get_page_words(page_idx)
        if not words:
            return []

        # Find Y-position of "Issuer/Instrument" header = start of holdings
        header_y = None
        for w in words:
            if w["text"] == "Issuer/Instrument" and w["x0"] > self.SIDEBAR_MAX_X:
                header_y = w["top"]
                break
        if header_y is None:
            return []

        # Find Y-position of "SECTOR ALLOCATION" or similar = end of holdings
        stop_y = self.HOLDINGS_STOP_Y
        for w in words:
            if w["text"] in ("SECTOR", "SYSTEMATIC", "Market") and w["top"] > header_y + 20:
                # Check if it's "SECTOR ALLOCATION" or "SYSTEMATIC INVESTMENT" or "Market Capitalisation"
                stop_y = w["top"] - 5
                break

        # Group words by Y into lines (only in holdings zone, excluding sidebar)
        lines: dict[int, list[tuple[float, str]]] = {}
        for w in words:
            if w["top"] <= header_y or w["top"] >= stop_y:
                continue
            if w["x0"] < self.SIDEBAR_MAX_X:
                continue  # Skip sidebar metadata
            y = round(w["top"])
            if y not in lines:
                lines[y] = []
            lines[y].append((w["x0"], w["text"]))

        holdings: list[Holding] = []
        current_sector_left = ""
        current_sector_right = ""

        for y in sorted(lines.keys()):
            line_words = sorted(lines[y], key=lambda t: t[0])

            # Split into left column and right column
            left_words = [(x, t) for x, t in line_words if x < self.RIGHT_NAME_MIN_X]
            right_words = [(x, t) for x, t in line_words if x >= self.RIGHT_NAME_MIN_X]

            # Process left column
            h = self._parse_column(left_words, self.LEFT_WEIGHT_MIN_X, self.LEFT_WEIGHT_MAX_X)
            if h:
                if is_sector_header(h[0]):
                    current_sector_left = h[0]
                elif not should_skip_line(h[0]):
                    holdings.append(Holding(stock_name=h[0], weight_pct=h[1], sector=current_sector_left))

            # Process right column
            h = self._parse_column(right_words, self.RIGHT_WEIGHT_MIN_X, self.RIGHT_WEIGHT_MAX_X)
            if h:
                if is_sector_header(h[0]):
                    current_sector_right = h[0]
                elif not should_skip_line(h[0]):
                    holdings.append(Holding(stock_name=h[0], weight_pct=h[1], sector=current_sector_right))

        return holdings

    def _parse_column(self, col_words: list[tuple[float, str]], weight_min_x: float, weight_max_x: float) -> Optional[tuple[str, float]]:
        """
        Parse a single column's words into (name, weight) or None.
        Weight is the decimal number at the known X-position range.
        Name is everything else joined.
        """
        if not col_words:
            return None

        weight: Optional[float] = None
        name_parts: list[str] = []

        for x, text in col_words:
            # Check if this word is a weight value at the expected X position
            if weight_min_x <= x <= weight_max_x and re.match(r"^\d{1,3}\.\d{1,2}$", text):
                val = float(text)
                if 0 < val <= 100:
                    weight = val
                    continue

            # Skip stray numbers, backtick amounts, metadata fragments
            if re.match(r"^[\d,`₹]+$", text):
                continue
            if text in ("%", "to", "Net", "Assets", "crs", "Cr", "Total"):
                continue

            name_parts.append(text)

        if weight is None or not name_parts:
            return None

        name = " ".join(name_parts).strip()
        # Clean garbled spaced-out text (e.g., "P ow e r F in an c e")
        if len(name) > 5 and name.count(" ") > len(name) / 3:
            # Likely garbled — try to reconstruct
            name = re.sub(r"(?<=[a-z])\s(?=[a-z])", "", name)
            name = re.sub(r"(?<=[A-Z])\s(?=[A-Z])", "", name)

        # Skip if name is too short or is metadata
        if len(name) < 3:
            return None
        if re.match(r"^(Equity|Debt|Money|Mutual|Grand|Sub|Net|Triparty|Treasury)", name):
            return None

        return (name, weight)

    def extract_fund_metadata(self, page_idx: int) -> dict:
        """Extract Kotak fund metadata from page text."""
        text = self.get_page_text(page_idx)
        meta: dict = {}

        # AUM
        aum_match = re.search(r"AUM:\s*`([\d,\.]+)\s*crs?", text)
        if aum_match:
            try:
                meta["aum_cr"] = float(aum_match.group(1).replace(",", ""))
            except ValueError:
                pass

        # Inception / Allotment Date
        date_match = re.search(r"(?:Allotment Date|Scheme Inception [Dd]ate)[:\s]+([A-Za-z]+ \d{1,2},?\s*\d{4})", text)
        if date_match:
            meta["inception_date"] = date_match.group(1).strip()

        # Benchmark
        bench_match = re.search(r"Benchmark\*{0,3}:\s*(.+?)(?:\n|$)", text)
        if bench_match:
            meta["benchmark"] = bench_match.group(1).strip()[:100]

        # Expense ratios
        ter_reg = re.search(r"Regular Plan:\s*([\d\.]+)%", text)
        if ter_reg:
            meta["expense_ratio_regular"] = float(ter_reg.group(1))
        ter_dir = re.search(r"Direct Plan:\s*([\d\.]+)%", text)
        if ter_dir:
            meta["expense_ratio_direct"] = float(ter_dir.group(1))

        # Quantitative ratios
        beta_m = re.search(r"Beta\s+([\d\.]+)", text)
        if beta_m:
            meta["beta"] = float(beta_m.group(1))
        sharpe_m = re.search(r"Sharpe[#\*]*\s+([\d\.]+)", text)
        if sharpe_m:
            meta["sharpe_ratio"] = float(sharpe_m.group(1))
        sd_m = re.search(r"Standard Deviation\s+([\d\.]+)%", text)
        if sd_m:
            meta["std_deviation"] = float(sd_m.group(1))
        pe_m = re.search(r"P/E\s+([\d\.]+)", text)
        if pe_m:
            meta["pe_ratio"] = float(pe_m.group(1))
        pb_m = re.search(r"P/BV\s+([\d\.]+)", text)
        if pb_m:
            meta["pb_ratio"] = float(pb_m.group(1))
        turnover_m = re.search(r"Portfolio Turnover\s+([\d\.]+)%", text)
        if turnover_m:
            meta["portfolio_turnover"] = float(turnover_m.group(1))

        # Market cap breakdown
        lc_m = re.search(r"Large Cap\s+([\d\.]+)%", text)
        if lc_m:
            meta["large_cap_pct"] = float(lc_m.group(1))
        mc_m = re.search(r"Mid Cap\s+([\d\.]+)%", text)
        if mc_m:
            meta["mid_cap_pct"] = float(mc_m.group(1))
        sc_m = re.search(r"Small Cap\s+([\d\.]+)%", text)
        if sc_m:
            meta["small_cap_pct"] = float(sc_m.group(1))

        return meta


# ═══════════════════════════════════════════════════════════════
#  AMC #2: EDELWEISS PARSER
# ═══════════════════════════════════════════════════════════════

class EdelweissParser(BaseAMCParser):
    """
    Edelweiss Mutual Fund factsheet parser.

    Layout: Each fund spans 2 pages. Page 1 has fund info + "Top 30 Holdings"
    in a clean two-column table. Page 2 has rolling returns + more data.

    Holdings format: "Company Name  Allocation%" in two columns.
    Very clean — word positions are consistent.
    """

    AMC_KEY = "edelweiss"

    def identify_fund_pages(self) -> list[tuple[str, list[int]]]:
        funds: list[tuple[str, list[int]]] = []
        seen_pages: set[int] = set()

        for i in range(self.total_pages):
            if i in seen_pages:
                continue

            text = self.get_page_text(i)
            if not text:
                continue

            # Must have holdings section AND be a primary fund page (not continuation)
            if "Top" not in text or "Holdings" not in text:
                continue
            if "Data as on" not in text:
                continue

            # Extract fund name — must be "Edelweiss ... Fund" in first 5 lines
            fund_name = self._extract_edelweiss_fund_name(text)
            if not fund_name:
                continue

            # Skip ETF, Index, FoF, Offshore pages
            upper = fund_name.upper()
            if any(skip in upper for skip in ["ETF", "INDEX", "FUND OF FUND", "FOF", "OFFSHORE"]):
                continue

            pages = [i]
            seen_pages.add(i)

            # Mark next page as continuation if it belongs to same fund
            if i + 1 < self.total_pages:
                next_text = self.get_page_text(i + 1)
                if next_text and ("Rolling" in next_text or "Trailing" in next_text):
                    # Verify it's the same fund (first word of fund name appears)
                    core_word = fund_name.split()[-2] if len(fund_name.split()) > 2 else fund_name.split()[0]
                    if core_word in next_text:
                        pages.append(i + 1)
                        seen_pages.add(i + 1)

            funds.append((fund_name, pages))

        return funds

    def _extract_edelweiss_fund_name(self, text: str) -> Optional[str]:
        """Extract fund name from first few lines. Must contain 'Edelweiss' and 'Fund'."""
        lines = text.split("\n")
        for line in lines[:5]:
            cleaned = line.strip()
            if not cleaned:
                continue
            if "Edelweiss" in cleaned and "Fund" in cleaned:
                # Remove trailing descriptions
                cleaned = re.sub(r"\s*An open.*$", "", cleaned, flags=re.I)
                return cleaned.strip()
        return None

    def extract_holdings_from_page(self, page_idx: int) -> list[Holding]:
        """
        Edelweiss has clean two-column holdings with consistent X positions.
        Col1: x ≈ 215 (name), x ≈ 346 (allocation)
        Col2: x ≈ 394 (name), x ≈ 526 (allocation)
        """
        lines = self.get_words_grouped_by_line(page_idx)
        holdings: list[Holding] = []

        in_holdings_section = False

        for y in sorted(lines.keys()):
            words = lines[y]
            line_text = " ".join(w[1] for w in words)

            # Detect holdings section start
            if "Company" in line_text and "Allocation" in line_text:
                in_holdings_section = True
                continue

            if not in_holdings_section:
                continue

            # Stop at section end markers
            if "Sector" in line_text and ("Overweight" in line_text or "Underweight" in line_text):
                break
            if "Market Capitalisation" in line_text or "Top 5" in line_text:
                break

            # Extract holdings from this line using position-based logic
            # Group words into left-column and right-column
            left_words = [(x, t) for x, t in words if x < 380]
            right_words = [(x, t) for x, t in words if x >= 380]

            for col_words in [left_words, right_words]:
                if not col_words:
                    continue

                # Find percentage value in this column
                pct_word = None
                name_words = []
                for _, t in col_words:
                    if re.match(r"\d{1,3}\.\d{1,2}%$", t):
                        pct_word = t
                    elif re.match(r"\d{1,3}\.\d{1,2}$", t) and float(t) <= 100:
                        pct_word = t
                    else:
                        # Skip non-name metadata
                        if t not in (":", "₹", "Cr.", "Cr", "Rs.", "Rs"):
                            name_words.append(t)

                if pct_word and name_words:
                    stock_name = " ".join(name_words).strip()
                    weight = float(pct_word.replace("%", ""))
                    if stock_name and weight > 0 and len(stock_name) > 2:
                        # Skip if it's just numbers/metadata
                        if not re.match(r"^[\d\s\.,%₹`]+$", stock_name):
                            holdings.append(Holding(
                                stock_name=stock_name,
                                weight_pct=weight,
                            ))

        return holdings

    def extract_fund_metadata(self, page_idx: int) -> dict:
        text = self.get_page_text(page_idx)
        meta: dict = {}

        # Inception Date
        inception = re.search(r"Inception Date\s+(\d{1,2}-[A-Za-z]+-\d{2,4})", text)
        if inception:
            meta["inception_date"] = inception.group(1)

        # Benchmark
        bench = re.search(r"Benchmark\s+(.+?)(?:\n|NAV)", text)
        if bench:
            meta["benchmark"] = bench.group(1).strip()[:100]

        # AUM
        aum = re.search(r"Month End AUM.*?:\s*([\d,]+)\s*Cr", text)
        if aum:
            try:
                meta["aum_cr"] = float(aum.group(1).replace(",", ""))
            except ValueError:
                pass

        # Expense ratios
        ter_reg = re.search(r"Regular Plan\s*:\s*([\d\.]+)%", text)
        if ter_reg:
            meta["expense_ratio_regular"] = float(ter_reg.group(1))
        ter_dir = re.search(r"Direct Plan\s*:\s*([\d\.]+)%", text)
        if ter_dir:
            meta["expense_ratio_direct"] = float(ter_dir.group(1))

        # Market cap
        lc = re.search(r"Large Cap\s+([\d\.]+)%", text)
        if lc:
            meta["large_cap_pct"] = float(lc.group(1))
        mc = re.search(r"Mid Cap\s+([\d\.]+)%", text)
        if mc:
            meta["mid_cap_pct"] = float(mc.group(1))
        sc = re.search(r"Small Cap\s+([\d\.]+)%", text)
        if sc:
            meta["small_cap_pct"] = float(sc.group(1))

        return meta


# ═══════════════════════════════════════════════════════════════
#  AMC #3: HDFC PARSER
# ═══════════════════════════════════════════════════════════════

class HDFCParser(BaseAMCParser):
    """
    HDFC Mutual Fund factsheet parser.

    Layout: Each fund is on a single page. Dense two-column layout.
    Holdings format: "Company/Instrument  Industry+/Rating  % to NAV"
    Sector is included inline with each holding.
    """

    AMC_KEY = "hdfc"

    def identify_fund_pages(self) -> list[tuple[str, list[int]]]:
        """
        HDFC: Each fund starts on a new page with "HDFC ... Fund" at top.
        Continuation pages have "....Contd from previous page".
        Merge continuations into the parent fund's page list.
        """
        funds: list[tuple[str, list[int]]] = []
        seen_pages: set[int] = set()

        for i in range(self.total_pages):
            if i in seen_pages:
                continue

            text = self.get_page_text(i)
            if not text:
                continue

            # Skip continuation pages (handled below)
            if "Contd from previous" in text:
                continue

            # Must have portfolio section
            if "PORTFOLIO" not in text:
                continue
            if "Company" not in text and "% to" not in text:
                continue

            fund_name = self._extract_hdfc_fund_name(text)
            if not fund_name:
                continue

            # Skip ETF, Index, FoF
            upper = fund_name.upper()
            if any(skip in upper for skip in ["ETF", "INDEX", "FUND OF FUND"]):
                continue

            pages = [i]
            seen_pages.add(i)

            # Check subsequent pages for continuation
            j = i + 1
            while j < self.total_pages:
                next_text = self.get_page_text(j)
                if next_text and "Contd from previous" in next_text:
                    pages.append(j)
                    seen_pages.add(j)
                    j += 1
                else:
                    break

            funds.append((fund_name, pages))

        return funds

    def _extract_hdfc_fund_name(self, text: str) -> Optional[str]:
        lines = text.split("\n")
        for line in lines[:5]:
            cleaned = line.strip()
            if "HDFC" in cleaned and "Fund" in cleaned:
                # Remove category description
                cleaned = re.sub(r"\s*CATEGORY OF SCHEME.*$", "", cleaned)
                return cleaned.strip()
        return None

    # HDFC geometric constants (from word position analysis)
    HDFC_SIDEBAR_MAX_X = 190
    HDFC_LEFT_NAME_X = 195       # Left col stock names start at x ≈ 201
    HDFC_LEFT_SECTOR_X = 260     # Left col sector at x ≈ 269
    HDFC_LEFT_WEIGHT_MIN_X = 340 # Left col weight at x ≈ 351
    HDFC_LEFT_WEIGHT_MAX_X = 365
    HDFC_RIGHT_NAME_X = 370      # Right col names at x ≈ 376
    HDFC_RIGHT_SECTOR_X = 435    # Right col sector at x ≈ 444
    HDFC_RIGHT_WEIGHT_MIN_X = 520  # Right col weight at x ≈ 531
    HDFC_RIGHT_WEIGHT_MAX_X = 545

    def extract_holdings_from_page(self, page_idx: int) -> list[Holding]:
        """
        HDFC: Position-based extraction.
        Left col:  name x≈201, sector x≈269, weight x≈351
        Right col: name x≈376, sector x≈444, weight x≈531
        """
        words = self.get_page_words(page_idx)
        if not words:
            return []

        # Find the "% to NAV" line which is BELOW the Company header — that's the real start
        header_y = None
        # First find "NAV" as column header (small word, in the weight position)
        for w in words:
            if w["text"] == "NAV" and w["x0"] > 340 and w["top"] < 200:
                header_y = w["top"]
                break
        if header_y is None:
            # Fallback: find Company/Instrument header
            for w in words:
                if "Company" in w["text"] and w["x0"] > self.HDFC_SIDEBAR_MAX_X and w["top"] < 200:
                    header_y = w["top"]
                    break
        if header_y is None:
            for w in words:
                if w["text"] == "PORTFOLIO" and w["x0"] > self.HDFC_SIDEBAR_MAX_X:
                    header_y = w["top"]
                    break
        if header_y is None:
            return []

        # Find stop position
        stop_y = 600
        for w in words:
            if w["text"] in ("SYSTEMATIC", "SIP", "QUANTITATIVE") and w["top"] > header_y + 20:
                stop_y = w["top"] - 5
                break

        # Group words by Y-line, excluding sidebar
        lines: dict[int, list[tuple[float, str]]] = {}
        for w in words:
            if w["top"] <= header_y or w["top"] >= stop_y:
                continue
            if w["x0"] < self.HDFC_SIDEBAR_MAX_X:
                continue
            y = round(w["top"])
            if y not in lines:
                lines[y] = []
            lines[y].append((w["x0"], w["text"]))

        holdings: list[Holding] = []

        # HDFC wraps long names across lines. Accumulate name/sector parts
        # per column and emit holding when weight is found.
        left_name_buf: list[str] = []
        left_sector_buf: list[str] = []
        right_name_buf: list[str] = []
        right_sector_buf: list[str] = []

        for y in sorted(lines.keys()):
            line_words = sorted(lines[y], key=lambda t: t[0])

            left_words = [(x, t) for x, t in line_words if x < self.HDFC_RIGHT_NAME_X]
            right_words = [(x, t) for x, t in line_words if x >= self.HDFC_RIGHT_NAME_X]

            # Process left column
            result = self._parse_hdfc_column(left_words, self.HDFC_LEFT_WEIGHT_MIN_X,
                                              self.HDFC_LEFT_WEIGHT_MAX_X, self.HDFC_LEFT_SECTOR_X)
            if result:
                name, weight, sector = result
                if weight is not None:
                    # Emit holding: prepend accumulated buffer
                    full_name = " ".join(left_name_buf + ([name] if name else []))
                    full_sector = " ".join(left_sector_buf + ([sector] if sector else []))
                    left_name_buf.clear()
                    left_sector_buf.clear()
                    if full_name and not should_skip_line(full_name):
                        holdings.append(Holding(stock_name=full_name.strip(), weight_pct=weight, sector=full_sector.strip()))
                else:
                    # No weight on this line — accumulate for next
                    if name:
                        left_name_buf.append(name)
                    if sector:
                        left_sector_buf.append(sector)

            # Process right column
            result = self._parse_hdfc_column(right_words, self.HDFC_RIGHT_WEIGHT_MIN_X,
                                              self.HDFC_RIGHT_WEIGHT_MAX_X, self.HDFC_RIGHT_SECTOR_X)
            if result:
                name, weight, sector = result
                if weight is not None:
                    full_name = " ".join(right_name_buf + ([name] if name else []))
                    full_sector = " ".join(right_sector_buf + ([sector] if sector else []))
                    right_name_buf.clear()
                    right_sector_buf.clear()
                    if full_name and not should_skip_line(full_name):
                        holdings.append(Holding(stock_name=full_name.strip(), weight_pct=weight, sector=full_sector.strip()))
                else:
                    if name:
                        right_name_buf.append(name)
                    if sector:
                        right_sector_buf.append(sector)

        return holdings

    def _parse_hdfc_column(self, col_words: list[tuple[float, str]],
                            weight_min_x: float, weight_max_x: float,
                            sector_x: float) -> Optional[tuple[str, Optional[float], str]]:
        """
        Parse HDFC column: (name_fragment, weight_or_None, sector_fragment).
        Weight may be None for continuation lines (name wraps across Y-lines).
        """
        if not col_words:
            return None

        weight: Optional[float] = None
        name_parts: list[str] = []
        sector_parts: list[str] = []

        for x, text in col_words:
            if weight_min_x <= x <= weight_max_x and re.match(r"^\d{1,3}\.\d{1,2}$", text):
                val = float(text)
                if 0 < val <= 100:
                    weight = val
                    continue

            # Skip bullets, stray chars, column header fragments
            if text in ("•", "*", "%", "to", "NAV", "NA", "V", "+", "/Rating"):
                continue
            # Strip footnote markers
            text = text.rstrip("£^#*")
            if re.match(r"^[\d,`₹]+$", text):
                continue

            # Classify as sector or name based on X position
            if x >= sector_x - 5:
                sector_parts.append(text)
            else:
                name_parts.append(text)

        name = " ".join(name_parts).strip()
        sector = " ".join(sector_parts).strip()

        # Skip known non-holding headers (but NOT "Company Ltd." which is part of stock names)
        if name and re.match(r"^(EQUITY & EQUITY|DEBT & DEBT|Sub Total|Government Securities|Units issued|Treasury|Triparty|TREPS|Net Current)", name, re.I):
            return None
        if name and re.match(r"^\d+\.\d+\s+GOI", name):
            return None

        # Return even if weight is None (continuation line)
        if not name and not sector:
            return None

        return (name, weight, sector)

    def extract_fund_metadata(self, page_idx: int) -> dict:
        text = self.get_page_text(page_idx)
        meta: dict = {}

        # AUM
        aum = re.search(r"(?:As on|AUM).*?₹([\d,\.]+)\s*Cr", text)
        if aum:
            try:
                meta["aum_cr"] = float(aum.group(1).replace(",", ""))
            except ValueError:
                pass

        # Inception Date
        inception = re.search(r"(?:INCEPTION DATE|Allotment Date|DATE OF ALLOTMENT)\s*[:\n]*\s*([A-Za-z]+ \d{1,2},?\s*\d{4})", text, re.I)
        if inception:
            meta["inception_date"] = inception.group(1).strip()

        # Ratios
        sd = re.search(r"Standard Deviation\s+([\d\.]+)%", text)
        if sd:
            meta["std_deviation"] = float(sd.group(1))
        beta = re.search(r"Beta\s+([\d\.]+)", text)
        if beta:
            meta["beta"] = float(beta.group(1))
        sharpe = re.search(r"Sharpe Ratio\*?\s+([\d\.]+)", text)
        if sharpe:
            meta["sharpe_ratio"] = float(sharpe.group(1))

        # Expense Ratio
        ter = re.search(r"TOTAL EXPENSE RATIO.*?Regular.*?([\d\.]+)%.*?Direct.*?([\d\.]+)%", text, re.S)
        if ter:
            meta["expense_ratio_regular"] = float(ter.group(1))
            meta["expense_ratio_direct"] = float(ter.group(2))

        return meta


# ═══════════════════════════════════════════════════════════════
#  AMC #4: ICICI PARSER
# ═══════════════════════════════════════════════════════════════

class ICICIParser(BaseAMCParser):
    """
    ICICI Prudential factsheet parser.

    Layout: Each fund page has returns table at top, then sector-grouped
    holdings with percentages in two columns.

    Holdings format:
      Sector Name Weight%
      • Stock Name Weight%
      • Stock Name Weight%
    """

    AMC_KEY = "icici"

    def identify_fund_pages(self) -> list[tuple[str, list[int]]]:
        funds: list[tuple[str, list[int]]] = []

        for i in range(self.total_pages):
            text = self.get_page_text(i)
            if not text:
                continue

            # ICICI fund pages have returns table + holdings
            if "ICICI Prudential" not in text:
                continue
            if "Returns of" not in text and "Fund" not in text:
                continue
            # Must have actual percentage holdings
            if not re.search(r"\d{1,2}\.\d{2}%", text):
                continue
            # Must have some stock-like names
            if "Ltd" not in text and "Limited" not in text:
                continue

            fund_name = self._extract_icici_fund_name(text)
            if fund_name:
                funds.append((fund_name, [i]))

        return funds

    def _extract_icici_fund_name(self, text: str) -> Optional[str]:
        # Match "ICICI Prudential ... Fund"
        match = re.search(r"(ICICI Prudential [A-Za-z& \-]+Fund)", text)
        if match:
            name = match.group(1).strip()
            # Remove duplicates from garbled text
            name = re.sub(r"\s+", " ", name)
            return name
        return None

    def extract_holdings_from_page(self, page_idx: int) -> list[Holding]:
        """
        ICICI: Sector-grouped holdings.
        Sectors appear as headers, stocks indented below with weights.
        """
        text = self.get_page_text(page_idx)
        holdings: list[Holding] = []
        current_sector = ""

        # Find the holdings section — usually after the returns table and fund info
        lines = text.split("\n")
        holdings_started = False

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Holdings section starts after style box / returns section
            # Look for first sector header with percentage
            if not holdings_started:
                # Detect start: first sector-like text with a percentage
                if re.search(r"^[A-Z][a-z].*\d{1,2}\.\d{2}%", stripped):
                    holdings_started = True
                elif "Financial Services" in stripped or "Banks" in stripped:
                    holdings_started = True
                else:
                    continue

            # Stop markers
            if any(term in stripped for term in [
                "Top 5 Stock", "Top 5 Sector", "Riskometer",
                "This Product", "Product is suitable", "product labelling",
            ]):
                break

            if should_skip_line(stripped):
                continue

            # Check for sector header: "Sector Name XX.XX%"
            sector_match = re.match(r"^([A-Z][A-Za-z, &\-/]+?)\s+(\d{1,3}\.\d{2})%", stripped)
            if sector_match:
                potential_sector = sector_match.group(1).strip()
                if is_sector_header(potential_sector) or len(potential_sector.split()) <= 4:
                    current_sector = potential_sector
                    continue

            # Stock line: "• Stock Name XX.XX%" or "Stock Name XX.XX%"
            stock_line = re.sub(r"^[•\*]\s*", "", stripped)
            pct_matches = list(re.finditer(r"(\d{1,3}\.\d{2})%", stock_line))
            if pct_matches:
                for m in pct_matches:
                    pct_val = float(m.group(1))
                    if pct_val <= 0 or pct_val > 50:
                        continue
                    name_part = stock_line[:m.start()].strip()
                    # Clean up
                    name_part = re.sub(r"\s{2,}", " ", name_part).strip()
                    if name_part and len(name_part) > 2 and not should_skip_line(name_part):
                        # Check it's not just a sector name
                        if not is_sector_header(name_part):
                            holdings.append(Holding(
                                stock_name=name_part,
                                weight_pct=pct_val,
                                sector=current_sector,
                            ))
                    stock_line = stock_line[m.end():]

        return holdings

    def extract_fund_metadata(self, page_idx: int) -> dict:
        text = self.get_page_text(page_idx)
        meta: dict = {}

        # NAV date
        nav_date = re.search(r"as on ([A-Za-z]+ \d{1,2},?\s*\d{4})", text, re.I)

        # Category
        cat = re.search(r"Category\s*\n?\s*(.+?)(?:\n|$)", text)
        if cat:
            meta["category"] = cat.group(1).strip()

        return meta


# ═══════════════════════════════════════════════════════════════
#  AMC #5: SBI PARSER
# ═══════════════════════════════════════════════════════════════

class SBIParser(BaseAMCParser):
    """
    SBI Mutual Fund factsheet parser.

    Layout: Two-column portfolio with fund info sidebar on left (x<190).
    Left column: stock names x≈199, weight x≈307 (% of Total AUM).
    Right column: stock names x≈392, weight x≈500.
    Fund name extracted from page header or "SBI ... Fund" pattern.
    """

    AMC_KEY = "sbi"

    # Geometric constants
    SIDEBAR_MAX_X = 190
    LEFT_NAME_MIN_X = 195
    LEFT_NAME_MAX_X = 300
    LEFT_WEIGHT_MIN_X = 300
    LEFT_WEIGHT_MAX_X = 330
    RIGHT_NAME_MIN_X = 388
    RIGHT_NAME_MAX_X = 495
    RIGHT_WEIGHT_MIN_X = 495
    RIGHT_WEIGHT_MAX_X = 530
    HEADER_MAX_Y = 210

    # SBI pages that should be skipped
    _SKIP_FUND_PATTERNS = re.compile(
        r"(ETF|Index|Nifty 50 Equal|Fund of Fund|FoF|Overnight|Liquid|"
        r"Money Market|Savings Fund|Ultra Short|Low Duration|Floater)",
        re.IGNORECASE,
    )

    def identify_fund_pages(self) -> list[tuple[str, list[int]]]:
        funds: list[tuple[str, list[int]]] = []
        seen: set[str] = set()

        for i in range(self.total_pages):
            text = self.get_page_text(i)
            if not text:
                continue

            # SBI fund pages have PORTFOLIO section with stock names + percentages
            if "PORTFOLIO" not in text.upper() and "% of AUM" not in text:
                continue
            if "Ltd" not in text and "Limited" not in text:
                continue

            fund_name = self._extract_sbi_fund_name(text)
            if not fund_name:
                continue
            if self._SKIP_FUND_PATTERNS.search(fund_name):
                continue
            if fund_name in seen:
                continue
            seen.add(fund_name)
            funds.append((fund_name, [i]))

        return funds

    def _extract_sbi_fund_name(self, text: str) -> Optional[str]:
        """Extract 'SBI ... Fund' from page text."""
        # Look in first 10 lines for fund name
        for line in text.split("\n")[:10]:
            # Match "SBI <words> Fund"
            m = re.search(r"(SBI\s+[A-Za-z& \-]+Fund)", line)
            if m:
                name = re.sub(r"\s+", " ", m.group(1).strip())
                if len(name) > 8:
                    return name
        return None

    def extract_holdings_from_page(self, page_idx: int) -> list[Holding]:
        """
        SBI layout varies per page. Detect column positions dynamically
        from the "(%) Of Total AUM" header words on each page.
        """
        words_raw = self.get_page_words(page_idx)
        if not words_raw:
            return []

        # Step 1: Detect weight column positions from header words.
        # SBI header variants:
        #   "Stock Name (%) Of Total AUM" — weights aligned under AUM (~362)
        #   "Stock Name (%) Total" — weights aligned to the right of "Total" (~315→weight ~330)
        # Strategy: find the first numeric weight in the holdings area and use its x-position.

        # Try "AUM" first, then fall back to first numeric weight
        aum_words = [w for w in words_raw
                     if w["text"].strip() == "AUM" and w["top"] < 260
                     and w["x0"] > 190]
        aum_words.sort(key=lambda w: w["x0"])

        aum_positions = []
        for w in aum_words:
            if not aum_positions or w["x0"] - aum_positions[-1] > 50:
                aum_positions.append(w["x0"])

        # Fallback: find first weights in holdings area to detect columns
        if len(aum_positions) < 2:
            # Find all numeric values in the holdings area
            weight_x_set = set()
            for w in words_raw:
                if w["top"] > 230 and w["x0"] > 190:
                    try:
                        val = float(w["text"])
                        if 0 < val < 50:
                            weight_x_set.add(round(w["x0"] / 10) * 10)  # round to 10s
                    except ValueError:
                        pass
            # Cluster the weight x-positions
            sorted_x = sorted(weight_x_set)
            clusters = []
            for x in sorted_x:
                if not clusters or x - clusters[-1][-1] > 30:
                    clusters.append([x])
                else:
                    clusters[-1].append(x)
            # Take the first value from each cluster
            aum_positions = [c[0] for c in clusters[:2]]

        if len(aum_positions) >= 2:
            left_weight_center = aum_positions[0]  # ~362 or ~307
            right_weight_center = aum_positions[1]  # ~556 or ~500
        elif len(aum_positions) == 1:
            left_weight_center = aum_positions[0]
            right_weight_center = left_weight_center + 195
        else:
            left_weight_center = 340
            right_weight_center = 540

        # Column boundaries: names start at x≈199, weight is ±20 around center
        left_name_min = 195
        left_name_max = left_weight_center - 40
        left_weight_min = left_weight_center - 20
        left_weight_max = left_weight_center + 20
        right_name_min = left_weight_center + 20
        right_name_max = right_weight_center - 20
        right_weight_min = right_weight_center - 20
        right_weight_max = right_weight_center + 20

        lines = self.get_words_grouped_by_line(page_idx)
        holdings: list[Holding] = []
        portfolio_started = False

        for y in sorted(lines.keys()):
            if y < self.HEADER_MAX_Y:
                continue

            line_words = lines[y]
            line_text = " ".join(w[1] for w in line_words)

            # Start after "Equity Shares" or "Stock Name"
            if ("Equity" in line_text and "Shares" in line_text) or \
               ("Stock" in line_text and "Name" in line_text):
                portfolio_started = True
                continue
            if not portfolio_started:
                continue

            # Stop markers
            if any(s in line_text for s in [
                "Treasury", "Grand Total", "T-Bill", "Repo Issue",
                "Cash, Cash", "Cash,Cash", "Foreign Equity",
            ]):
                break

            left_name_parts = []
            left_weight = None
            right_name_parts = []
            right_weight = None

            for x, text in line_words:
                text_clean = text.strip().rstrip("£^#*")
                if not text_clean or len(text_clean) < 2:
                    continue

                if left_name_min <= x <= left_name_max:
                    left_name_parts.append(text_clean)
                elif left_weight_min <= x <= left_weight_max:
                    try:
                        val = float(text_clean)
                        if 0 < val <= 50:
                            left_weight = val
                    except ValueError:
                        pass
                elif right_name_min <= x <= right_name_max:
                    right_name_parts.append(text_clean)
                elif right_weight_min <= x <= right_weight_max:
                    try:
                        val = float(text_clean)
                        if 0 < val <= 50:
                            right_weight = val
                    except ValueError:
                        pass

            # Emit left holding
            if left_name_parts and left_weight is not None:
                name = " ".join(left_name_parts)
                if not should_skip_line(name) and len(name) > 3:
                    holdings.append(Holding(stock_name=name, weight_pct=left_weight))

            # Emit right holding
            if right_name_parts and right_weight is not None:
                name = " ".join(right_name_parts)
                if not should_skip_line(name) and len(name) > 3:
                    holdings.append(Holding(stock_name=name, weight_pct=right_weight))

        return holdings

    def extract_fund_metadata(self, page_idx: int) -> dict:
        text = self.get_page_text(page_idx)
        meta: dict = {}

        # AUM
        aum = re.search(r"AUM.*?`\s*([\d,]+\.?\d*)\s*Crores", text, re.I)
        if aum:
            try:
                meta["aum_cr"] = float(aum.group(1).replace(",", ""))
            except ValueError:
                pass

        # Date of Allotment
        allot = re.search(r"Date of Allotment[:\s]+(\d{2}/\d{2}/\d{4})", text)
        if allot:
            meta["inception_date"] = allot.group(1)

        # Benchmark
        bench = re.search(r"Benchmark[:\s]+(.+?)(?:\n|$)", text, re.I)
        if bench:
            meta["benchmark"] = bench.group(1).strip()

        return meta


# ═══════════════════════════════════════════════════════════════
#  AMC #6: ABSL (ADITYA BIRLA SUN LIFE) PARSER
# ═══════════════════════════════════════════════════════════════

class ABSLParser(BaseAMCParser):
    """
    Aditya Birla Sun Life factsheet parser.

    Layout: Two-column with sector headers.
    Left: names x≈22, weights x≈230. Right: names x≈319, weights x≈528.
    Sector headers appear as "Banks 25.56%" spanning both columns.
    "PORTFOLIO" keyword marks start of holdings section.
    """

    AMC_KEY = "aditya_birla"

    # Geometric constants
    LEFT_NAME_MIN_X = 15
    LEFT_NAME_MAX_X = 220
    LEFT_WEIGHT_MIN_X = 220
    LEFT_WEIGHT_MAX_X = 260
    RIGHT_NAME_MIN_X = 310
    RIGHT_NAME_MAX_X = 520
    RIGHT_WEIGHT_MIN_X = 520
    RIGHT_WEIGHT_MAX_X = 560

    _SKIP_FUND_PATTERNS = re.compile(
        r"(ETF|Index Fund|Nifty\s+\d|Fund of Fund|FoF|Overnight|Liquid|"
        r"International|Arbitrage|Nasdaq|Pharma & Healthcare)",
        re.IGNORECASE,
    )

    def identify_fund_pages(self) -> list[tuple[str, list[int]]]:
        funds: list[tuple[str, list[int]]] = []
        seen: set[str] = set()

        for i in range(self.total_pages):
            text = self.get_page_text(i)
            if not text:
                continue

            # Must have PORTFOLIO section with actual holdings
            if "PORTFOLIO" not in text.upper():
                continue
            if "Ltd" not in text and "Limited" not in text:
                continue
            if "% to Net Assets" not in text and "% of Net" not in text:
                # Check for "Issuer" + percentage pattern
                if not re.search(r"Issuer.*?%", text, re.I):
                    continue

            fund_name = self._extract_absl_fund_name(text)
            if not fund_name:
                continue
            if self._SKIP_FUND_PATTERNS.search(fund_name):
                continue
            if fund_name in seen:
                continue
            seen.add(fund_name)
            funds.append((fund_name, [i]))

        return funds

    def _extract_absl_fund_name(self, text: str) -> Optional[str]:
        """Extract 'Aditya Birla Sun Life ... Fund' from first few lines."""
        for line in text.split("\n")[:5]:
            m = re.search(r"(Aditya Birla Sun Life [A-Za-z& \-]+Fund)", line)
            if m:
                return re.sub(r"\s+", " ", m.group(1).strip())
        return None

    def extract_holdings_from_page(self, page_idx: int) -> list[Holding]:
        lines = self.get_words_grouped_by_line(page_idx)
        holdings: list[Holding] = []
        current_sector_left = ""
        current_sector_right = ""
        portfolio_started = False

        for y in sorted(lines.keys()):
            words = lines[y]
            line_text = " ".join(w[1] for w in words)

            # Start at PORTFOLIO marker
            if "PORTFOLIO" in line_text.upper():
                portfolio_started = True
                continue
            if not portfolio_started:
                continue
            # Skip header row
            if "Issuer" in line_text and "Net Assets" in line_text:
                continue

            # Stop markers
            if any(s in line_text for s in [
                "Grand Total", "Cash & Cash", "Cash and Cash",
                "Net Current Asset", "Total Net Asset", "TREPS",
                "Reverse Repo", "Treasury Bill",
            ]):
                break

            # Separate left and right column words
            left_name_parts = []
            left_weight_str = None
            right_name_parts = []
            right_weight_str = None

            for x, text_w in words:
                text_clean = text_w.strip().rstrip("£^#*%")
                if not text_clean:
                    continue

                if self.LEFT_NAME_MIN_X <= x < self.LEFT_WEIGHT_MIN_X:
                    left_name_parts.append(text_clean)
                elif self.LEFT_WEIGHT_MIN_X <= x < self.LEFT_WEIGHT_MAX_X:
                    left_weight_str = text_clean.rstrip("%")
                elif self.RIGHT_NAME_MIN_X <= x < self.RIGHT_WEIGHT_MIN_X:
                    right_name_parts.append(text_clean)
                elif self.RIGHT_WEIGHT_MIN_X <= x < self.RIGHT_WEIGHT_MAX_X:
                    right_weight_str = text_clean.rstrip("%")

            # Parse left column
            left_name = " ".join(left_name_parts).strip()
            left_weight = self._parse_weight(left_weight_str)

            # Parse right column
            right_name = " ".join(right_name_parts).strip()
            right_weight = self._parse_weight(right_weight_str)

            # Detect sector headers: have weight but are known sectors
            if left_name and left_weight is not None:
                if is_sector_header(left_name):
                    current_sector_left = left_name
                elif not should_skip_line(left_name) and len(left_name) > 3:
                    holdings.append(Holding(
                        stock_name=left_name,
                        weight_pct=left_weight,
                        sector=current_sector_left,
                    ))

            if right_name and right_weight is not None:
                if is_sector_header(right_name):
                    current_sector_right = right_name
                elif not should_skip_line(right_name) and len(right_name) > 3:
                    holdings.append(Holding(
                        stock_name=right_name,
                        weight_pct=right_weight,
                        sector=current_sector_right,
                    ))

            # Sector header without weight on left (just name)
            if left_name and left_weight is None and not left_name_parts == []:
                if is_sector_header(left_name):
                    current_sector_left = left_name
            if right_name and right_weight is None:
                if is_sector_header(right_name):
                    current_sector_right = right_name

        return holdings

    @staticmethod
    def _parse_weight(s: Optional[str]) -> Optional[float]:
        if not s:
            return None
        try:
            val = float(s)
            if 0 < val <= 100:
                return val
        except ValueError:
            pass
        return None

    def extract_fund_metadata(self, page_idx: int) -> dict:
        text = self.get_page_text(page_idx)
        meta: dict = {}

        # AUM
        aum = re.search(r"AUM.*?`\s*([\d,]+\.?\d*)\s*Crores", text, re.I)
        if aum:
            try:
                meta["aum_cr"] = float(aum.group(1).replace(",", ""))
            except ValueError:
                pass

        # Standard Deviation, Sharpe, Beta, P/E, P/BV
        for label, key in [
            (r"Standard Deviation", "std_deviation"),
            (r"Sharpe Ratio", "sharpe_ratio"),
            (r"Beta", "beta"),
            (r"Average P/E", "pe_ratio"),
            (r"Average P/BV?", "pb_ratio"),
            (r"Portfolio Turnover", "portfolio_turnover"),
        ]:
            m = re.search(rf"{label}\s+([\d.]+)%?", text, re.I)
            if m:
                try:
                    meta[key] = float(m.group(1))
                except ValueError:
                    pass

        return meta


# ═══════════════════════════════════════════════════════════════
#  AMC #7: NIPPON PARSER
# ═══════════════════════════════════════════════════════════════

class NipponParser(BaseAMCParser):
    """
    Nippon India Mutual Fund factsheet parser.

    Layout: Two-column with sector headers.
    Left: names x≈221, weights x≈380. Right: names x≈401, weights x≈555.
    Sector headers appear as text-only lines (no percentage).
    Fund name: "Nippon India ... Fund" at top.
    """

    AMC_KEY = "nippon"

    # Geometric constants
    LEFT_NAME_MIN_X = 215
    LEFT_NAME_MAX_X = 370
    LEFT_WEIGHT_MIN_X = 370
    LEFT_WEIGHT_MAX_X = 398
    RIGHT_NAME_MIN_X = 395
    RIGHT_NAME_MAX_X = 545
    RIGHT_WEIGHT_MIN_X = 545
    RIGHT_WEIGHT_MAX_X = 575

    _SKIP_FUND_PATTERNS = re.compile(
        r"(ETF|Index Fund|Nifty\s+\d|Fund of Fund|FoF|Overnight|Liquid Fund|"
        r"Gold Savings|Silver|Arbitrage|Taiwan Equity)",
        re.IGNORECASE,
    )

    def identify_fund_pages(self) -> list[tuple[str, list[int]]]:
        funds: list[tuple[str, list[int]]] = []
        seen: set[str] = set()

        for i in range(self.total_pages):
            text = self.get_page_text(i)
            if not text:
                continue

            # Must have "Portfolio as on" and actual stock holdings
            if "Portfolio as on" not in text and "Portfolio As On" not in text:
                if "% of Assets" not in text:
                    continue
            if "Ltd" not in text and "Limited" not in text:
                continue

            fund_name = self._extract_nippon_fund_name(text)
            if not fund_name:
                continue
            if self._SKIP_FUND_PATTERNS.search(fund_name):
                continue
            if fund_name in seen:
                continue
            seen.add(fund_name)
            funds.append((fund_name, [i]))

        return funds

    def _extract_nippon_fund_name(self, text: str) -> Optional[str]:
        for line in text.split("\n")[:5]:
            m = re.search(r"(Nippon India [A-Za-z& \-]+Fund)", line)
            if m:
                return re.sub(r"\s+", " ", m.group(1).strip())
        return None

    def extract_holdings_from_page(self, page_idx: int) -> list[Holding]:
        lines = self.get_words_grouped_by_line(page_idx)
        holdings: list[Holding] = []
        current_sector_left = ""
        current_sector_right = ""
        portfolio_started = False

        for y in sorted(lines.keys()):
            words = lines[y]
            line_text = " ".join(w[1] for w in words)

            # Start after header: "Company/Issuer % of Assets"
            if "Company" in line_text and "Issuer" in line_text:
                portfolio_started = True
                continue
            if "% of Assets" in line_text and not portfolio_started:
                portfolio_started = True
                continue
            if not portfolio_started:
                continue

            # Stop markers
            if any(s in line_text for s in [
                "Grand Total", "Cash and Other", "Equity Less Than",
                "Net Current", "TREPS", "Reverse Repo",
            ]):
                break

            # Classify words into left/right columns
            left_name_parts = []
            left_weight = None
            right_name_parts = []
            right_weight = None

            for x, text_w in words:
                text_clean = text_w.strip().rstrip("£^#*%")
                if not text_clean:
                    continue

                if self.LEFT_NAME_MIN_X <= x < self.LEFT_WEIGHT_MIN_X:
                    left_name_parts.append(text_clean)
                elif self.LEFT_WEIGHT_MIN_X <= x < self.LEFT_WEIGHT_MAX_X:
                    try:
                        val = float(text_clean)
                        if 0 < val <= 50:
                            left_weight = val
                    except ValueError:
                        pass
                elif self.RIGHT_NAME_MIN_X <= x < self.RIGHT_WEIGHT_MIN_X:
                    right_name_parts.append(text_clean)
                elif self.RIGHT_WEIGHT_MIN_X <= x < self.RIGHT_WEIGHT_MAX_X:
                    try:
                        val = float(text_clean)
                        if 0 < val <= 50:
                            right_weight = val
                    except ValueError:
                        pass

            left_name = " ".join(left_name_parts).strip()
            right_name = " ".join(right_name_parts).strip()

            # Detect sector headers (lines with name but no weight)
            if left_name and left_weight is None:
                if is_sector_header(left_name) or (
                    len(left_name.split()) <= 4 and left_name[0].isupper()
                    and "Limited" not in left_name and "Ltd" not in left_name
                ):
                    current_sector_left = left_name
            if right_name and right_weight is None:
                if is_sector_header(right_name) or (
                    len(right_name.split()) <= 4 and right_name[0].isupper()
                    and "Limited" not in right_name and "Ltd" not in right_name
                ):
                    current_sector_right = right_name

            # Emit holdings (must have name + weight + look like a stock)
            if left_name and left_weight is not None:
                if not is_sector_header(left_name) and not should_skip_line(left_name) and len(left_name) > 3:
                    holdings.append(Holding(
                        stock_name=left_name,
                        weight_pct=left_weight,
                        sector=current_sector_left,
                    ))
            if right_name and right_weight is not None:
                if not is_sector_header(right_name) and not should_skip_line(right_name) and len(right_name) > 3:
                    holdings.append(Holding(
                        stock_name=right_name,
                        weight_pct=right_weight,
                        sector=current_sector_right,
                    ))

        return holdings

    def extract_fund_metadata(self, page_idx: int) -> dict:
        text = self.get_page_text(page_idx)
        meta: dict = {}

        # Standard Deviation, Beta, Sharpe
        for label, key in [
            (r"Standard Deviation", "std_deviation"),
            (r"Sharpe Ratio", "sharpe_ratio"),
            (r"Beta", "beta"),
            (r"Portfolio Turnover \(Times\)", "portfolio_turnover"),
        ]:
            m = re.search(rf"{label}\s+([\d.]+)", text, re.I)
            if m:
                try:
                    meta[key] = float(m.group(1))
                except ValueError:
                    pass

        # Fund Size
        aum = re.search(r"Month End[:\s]*₹?\s*([\d,.]+)\s*Cr", text, re.I)
        if aum:
            try:
                meta["aum_cr"] = float(aum.group(1).replace(",", ""))
            except ValueError:
                pass

        return meta


# ═══════════════════════════════════════════════════════════════
#  AMC #8: INVESCO PARSER
# ═══════════════════════════════════════════════════════════════

class InvescoParser(BaseAMCParser):
    """
    Invesco India factsheet parser.

    Layout: Two-column portfolio, heavily garbled text extraction.
    Left: names x≈196, weights x≈363-366. Right: names x≈385, weights x≈553-555.
    Many stock names are split into individual characters in pdfplumber.
    The _reconstruct_name method joins character-level fragments.
    """

    AMC_KEY = "invesco"

    # Geometric constants
    LEFT_NAME_MIN_X = 190
    LEFT_NAME_MAX_X = 355
    LEFT_WEIGHT_MIN_X = 355
    LEFT_WEIGHT_MAX_X = 380
    RIGHT_NAME_MIN_X = 380
    RIGHT_NAME_MAX_X = 545
    RIGHT_WEIGHT_MIN_X = 545
    RIGHT_WEIGHT_MAX_X = 575

    _SKIP_FUND_PATTERNS = re.compile(
        r"(ETF|Index Fund|Nifty\s+\d|Fund of Fund|FoF|Overnight|Liquid Fund|"
        r"Arbitrage|Gold)",
        re.IGNORECASE,
    )

    def identify_fund_pages(self) -> list[tuple[str, list[int]]]:
        funds: list[tuple[str, list[int]]] = []
        seen: set[str] = set()

        for i in range(self.total_pages):
            text = self.get_page_text(i)
            if not text:
                continue

            # Must have Portfolio section with holdings
            if "Portfolio" not in text:
                continue
            if "Ltd" not in text and "Limited" not in text:
                continue
            if "% of Net" not in text and "% of" not in text:
                continue

            fund_name = self._extract_invesco_fund_name(text)
            if not fund_name:
                continue
            if self._SKIP_FUND_PATTERNS.search(fund_name):
                continue
            if fund_name in seen:
                continue
            seen.add(fund_name)
            funds.append((fund_name, [i]))

        return funds

    def _extract_invesco_fund_name(self, text: str) -> Optional[str]:
        for line in text.split("\n")[:3]:
            m = re.search(r"(Invesco India [A-Za-z& \-]+Fund)", line)
            if m:
                return re.sub(r"\s+", " ", m.group(1).strip())
        return None

    def extract_holdings_from_page(self, page_idx: int) -> list[Holding]:
        """
        Invesco pages have heavily fragmented text. Use raw word positions
        and reconstruct names by joining adjacent character fragments.
        """
        words = self.get_page_words(page_idx)
        lines = self.get_words_grouped_by_line(page_idx, y_tolerance=4.0)
        holdings: list[Holding] = []
        portfolio_started = False

        for y in sorted(lines.keys()):
            line_words = lines[y]
            line_text = " ".join(w[1] for w in line_words)

            # Start after "Portfolio" + "Company" header
            if "Portfolio" in line_text and ("on" in line_text or "Holdings" in line_text):
                portfolio_started = True
                continue
            if "Company" in line_text and "Net" in line_text:
                portfolio_started = True
                continue
            if not portfolio_started:
                continue

            # Stop markers
            if "100.00" in line_text:
                break
            if any(s in line_text for s in [
                "Cash &", "Cash and", "Preference Shares",
                "Industry Classification", "Asset Allocation",
                "Market Capitalization",
            ]):
                break

            # Skip metadata/header noise — only check words in the holdings columns (x > 190)
            # The left sidebar (x < 190) has metadata like "Regular 1.89%" on same y-line as holdings
            holdings_word_set = {w[1] for w in line_words if w[0] >= self.LEFT_NAME_MIN_X}
            skip_words = {"Assets", "Instruments", "Turnover"}
            if holdings_word_set & skip_words:
                continue

            # Classify words
            left_words = []
            left_weight_parts = []
            right_words = []
            right_weight_parts = []

            for x, text_w in line_words:
                text_clean = text_w.strip().rstrip("£^#*%")
                if not text_clean:
                    continue

                if self.LEFT_NAME_MIN_X <= x < self.LEFT_WEIGHT_MIN_X:
                    left_words.append((x, text_clean))
                elif self.LEFT_WEIGHT_MIN_X <= x < self.LEFT_WEIGHT_MAX_X:
                    left_weight_parts.append(text_clean)
                elif self.RIGHT_NAME_MIN_X <= x < self.RIGHT_WEIGHT_MIN_X:
                    right_words.append((x, text_clean))
                elif self.RIGHT_WEIGHT_MIN_X <= x < self.RIGHT_WEIGHT_MAX_X:
                    right_weight_parts.append(text_clean)

            # Parse weights — join fragments like ["2", ".", "4", "3"] → 2.43
            left_weight = self._parse_weight_parts(left_weight_parts)
            right_weight = self._parse_weight_parts(right_weight_parts)

            # Reconstruct names from potentially fragmented words
            left_name = self._reconstruct_name(left_words)
            right_name = self._reconstruct_name(right_words)

            # Emit holdings
            if left_name and left_weight is not None:
                if not is_sector_header(left_name) and not should_skip_line(left_name) and len(left_name) > 3:
                    holdings.append(Holding(stock_name=left_name, weight_pct=left_weight))
            if right_name and right_weight is not None:
                if not is_sector_header(right_name) and not should_skip_line(right_name) and len(right_name) > 3:
                    holdings.append(Holding(stock_name=right_name, weight_pct=right_weight))

        return holdings

    @staticmethod
    def _parse_weight_parts(parts: list[str]) -> Optional[float]:
        """Parse weight from potentially fragmented tokens."""
        if not parts:
            return None
        # If single clean token
        if len(parts) == 1:
            try:
                val = float(parts[0])
                return val if 0 < val <= 50 else None
            except ValueError:
                return None
        # Join fragments: ["2", ".", "4", "3"] → "2.43"
        joined = "".join(parts)
        try:
            val = float(joined)
            return val if 0 < val <= 50 else None
        except ValueError:
            return None

    @staticmethod
    def _reconstruct_name(word_tuples: list[tuple[float, str]]) -> str:
        """
        Reconstruct a stock name from potentially character-level fragments.
        E.g., [(196, 'C'), (200, 'h'), (204, 'o'), ...] → "Cholamandalam Investment and"
        Adjacent characters (x gap < 5) are joined without space;
        normal word gaps (x gap >= 5) get a space.
        """
        if not word_tuples:
            return ""

        result = []
        prev_x_end = None
        prev_text = ""

        for x, text in word_tuples:
            if prev_x_end is not None:
                gap = x - prev_x_end
                if gap < 3 and len(prev_text) <= 2 and len(text) <= 2:
                    # Character-level fragment — join directly
                    result.append(text)
                else:
                    result.append(" " + text)
            else:
                result.append(text)
            prev_x_end = x + len(text) * 5.5  # approximate character width
            prev_text = text

        name = "".join(result).strip()
        # Clean up double spaces
        name = re.sub(r"\s+", " ", name)
        return name

    def extract_fund_metadata(self, page_idx: int) -> dict:
        text = self.get_page_text(page_idx)
        meta: dict = {}

        for label, key in [
            (r"Standard Deviation", "std_deviation"),
            (r"Sharpe Ratio", "sharpe_ratio"),
            (r"Beta", "beta"),
        ]:
            m = re.search(rf"{label}\s+([\d.]+)%?", text, re.I)
            if m:
                try:
                    meta[key] = float(m.group(1))
                except ValueError:
                    pass

        return meta


# ═══════════════════════════════════════════════════════════════
#  DATABASE INTEGRATION
# ═══════════════════════════════════════════════════════════════

def get_db_connection():
    """Get database connection."""
    return psycopg2.connect(DB_URL)


def match_fund_to_scheme_code(conn, fund_name: str) -> Optional[str]:
    """
    Match parsed fund name to scheme_code in our funds table.
    Uses fuzzy text matching on scheme_name.
    """
    cur = conn.cursor()

    # Clean fund name for matching
    clean = fund_name.strip()
    clean = re.sub(r"\s+", " ", clean)

    # Try exact-ish match first (Direct Growth)
    search_term = f"%{clean}%Direct%Growth%"
    cur.execute("""
        SELECT scheme_code, scheme_name FROM funds
        WHERE UPPER(scheme_name) LIKE UPPER(%s)
        AND plan_type = 'Direct' AND option_type = 'Growth'
        LIMIT 1
    """, (search_term,))
    row = cur.fetchone()
    if row:
        return row[0]

    # Try without plan/option filter
    # Extract core name words (remove "KOTAK", "HDFC" etc. for broader match)
    core_words = []
    for word in clean.split():
        if word.upper() not in ("KOTAK", "HDFC", "ICICI", "PRUDENTIAL", "EDELWEISS",
                                "SBI", "AXIS", "MUTUAL", "FUND", "SCHEME"):
            core_words.append(word)

    if core_words:
        # Build parameterized ILIKE conditions for core words
        words_to_match = core_words[:3]
        conditions = " AND ".join([f"UPPER(scheme_name) LIKE UPPER(%s)" for _ in words_to_match])
        params = [f"%{w}%" for w in words_to_match]
        query = f"""
            SELECT scheme_code, scheme_name FROM funds
            WHERE {conditions}
            AND plan_type = 'Direct' AND option_type = 'Growth'
            ORDER BY LENGTH(scheme_name)
            LIMIT 1
        """
        cur.execute(query, params)
        row = cur.fetchone()
        if row:
            return row[0]

    # Last resort: trigram search if pg_trgm is available
    try:
        cur.execute("""
            SELECT scheme_code, scheme_name,
                   similarity(UPPER(scheme_name), UPPER(%s)) AS sim
            FROM funds
            WHERE plan_type = 'Direct' AND option_type = 'Growth'
            AND similarity(UPPER(scheme_name), UPPER(%s)) > 0.3
            ORDER BY sim DESC
            LIMIT 1
        """, (clean, clean))
        row = cur.fetchone()
        if row:
            return row[0]
    except Exception:
        pass

    return None


def save_fund_to_db(conn, fund: FundPage, scheme_code: str, as_of_date: str) -> int:
    """
    Save holdings to fund_top_holdings and scheme_stock_index.
    Returns count of holdings inserted.
    """
    cur = conn.cursor()
    inserted = 0

    for rank, h in enumerate(fund.holdings, 1):
        # Normalize sector
        sector_id, sector_name = normalize_sector(h.sector)

        try:
            cur.execute("""
                INSERT INTO fund_top_holdings
                    (scheme_code, holding_name, holding_isin, weight_pct, sector, rank, as_of_date)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (scheme_code, holding_name, as_of_date)
                DO UPDATE SET
                    weight_pct = EXCLUDED.weight_pct,
                    sector = EXCLUDED.sector,
                    rank = EXCLUDED.rank,
                    holding_isin = COALESCE(EXCLUDED.holding_isin, fund_top_holdings.holding_isin),
                    fetched_at = NOW()
            """, (
                scheme_code,
                h.stock_name.strip(),
                h.isin or None,
                h.weight_pct,
                sector_name,
                rank,
                as_of_date,
            ))
            inserted += 1
        except Exception as e:
            log.warning(f"    Failed to insert {h.stock_name}: {e}")

        # Also insert into scheme_stock_index if ISIN available
        if h.isin:
            try:
                cur.execute("""
                    INSERT INTO scheme_stock_index (scheme_code, isin, stock_name, weight_pct)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (scheme_code, h.isin, h.stock_name.strip(), h.weight_pct))
            except Exception:
                pass

    # Update scheme_sector_summary (pre-aggregated screener index)
    if inserted > 0:
        try:
            cur.execute("""
                INSERT INTO scheme_sector_summary (scheme_code, master_sector_id, total_weight)
                SELECT %s, sa.master_sector_id, SUM(fth.weight_pct)
                FROM fund_top_holdings fth
                LEFT JOIN sector_aliases sa ON LOWER(fth.sector) = LOWER(sa.raw_sector)
                WHERE fth.scheme_code = %s AND fth.as_of_date = %s
                AND sa.master_sector_id IS NOT NULL
                GROUP BY sa.master_sector_id
                ON CONFLICT (scheme_code, master_sector_id)
                DO UPDATE SET total_weight = EXCLUDED.total_weight
            """, (scheme_code, scheme_code, as_of_date))
        except Exception as e:
            log.debug(f"    Sector summary update skipped: {e}")

    conn.commit()
    return inserted


def save_fund_metadata_to_db(conn, fund: FundPage, scheme_code: str) -> None:
    """Update fund metadata (ratios, AUM, etc.) in fund_returns or funds table."""
    cur = conn.cursor()

    updates = []
    params = []

    if fund.aum_cr:
        updates.append("fund_size = %s")
        params.append(fund.aum_cr)
    if fund.expense_ratio_direct:
        updates.append("expense_ratio = %s")
        params.append(fund.expense_ratio_direct)

    if updates and scheme_code:
        query = f"UPDATE fund_returns SET {', '.join(updates)} WHERE scheme_code = %s"
        params.append(scheme_code)
        try:
            cur.execute(query, params)
            conn.commit()
        except Exception as e:
            log.debug(f"    Metadata update skipped: {e}")
            conn.rollback()


# ═══════════════════════════════════════════════════════════════
#  CLI RUNNER
# ═══════════════════════════════════════════════════════════════

def extract_as_of_date_from_filename(filename: str) -> str:
    """Extract date from filename or return current date."""
    # Try patterns like "February2026", "January-2026", "Jan2026"
    months = {
        "january": "01", "february": "02", "march": "03", "april": "04",
        "may": "05", "june": "06", "july": "07", "august": "08",
        "september": "09", "october": "10", "november": "11", "december": "12",
        "jan": "01", "feb": "02", "mar": "03", "apr": "04",
        "jun": "06", "jul": "07", "aug": "08", "sep": "09",
        "oct": "10", "nov": "11", "dec": "12",
    }
    lower = filename.lower()
    for month_name, month_num in months.items():
        pattern = rf"{month_name}\s*[-_]?\s*(\d{{4}})"
        m = re.search(pattern, lower)
        if m:
            year = m.group(1)
            # Use last day of month as approximate date
            from calendar import monthrange
            _, last_day = monthrange(int(year), int(month_num))
            return f"{year}-{month_num}-{last_day:02d}"

    # Fallback: current date
    from datetime import date
    return date.today().isoformat()


def process_single_pdf(pdf_path: str, amc_override: Optional[str] = None, dry_run: bool = False) -> dict:
    """Process a single PDF file and return stats."""
    path = Path(pdf_path)
    log.info(f"\n{'='*60}")
    log.info(f"Processing: {path.name}")
    log.info(f"{'='*60}")

    # Detect or use provided AMC
    amc = amc_override or ParserFactory.detect_amc(str(path))
    if not amc:
        log.error(f"Cannot detect AMC for {path.name}. Use --amc flag.")
        return {"file": path.name, "error": "AMC detection failed"}

    # Check if parser exists
    if amc not in BaseAMCParser._registry:
        log.error(f"No parser implemented for AMC '{amc}'. Available: {ParserFactory.list_parsers()}")
        return {"file": path.name, "error": f"No parser for {amc}"}

    # Parse
    parser = ParserFactory.get_parser(amc, str(path))
    funds = parser.parse()

    as_of_date = extract_as_of_date_from_filename(path.name)
    log.info(f"As-of date: {as_of_date}")

    stats = {
        "file": path.name,
        "amc": amc,
        "funds_found": len(funds),
        "funds_matched": 0,
        "funds_unmatched": 0,
        "holdings_imported": 0,
        "as_of_date": as_of_date,
    }

    if dry_run:
        log.info("\n[DRY RUN] Would import:")
        for f in funds:
            log.info(f"  {f.fund_name}: {f.holding_count} holdings, equity: {f.equity_total:.1f}%")
            for h in f.holdings[:5]:
                log.info(f"    {h.stock_name}: {h.weight_pct}% [{h.sector}]")
            if f.holding_count > 5:
                log.info(f"    ... and {f.holding_count - 5} more")
        return stats

    # DB operations
    conn = get_db_connection()
    load_sector_aliases(conn)

    for fund in funds:
        scheme_code = match_fund_to_scheme_code(conn, fund.fund_name)
        if not scheme_code:
            log.warning(f"  ✗ No match for: {fund.fund_name}")
            stats["funds_unmatched"] += 1
            continue

        log.info(f"  ✓ Matched: {fund.fund_name} → {scheme_code}")
        stats["funds_matched"] += 1

        count = save_fund_to_db(conn, fund, scheme_code, as_of_date)
        stats["holdings_imported"] += count

        # Update metadata
        save_fund_metadata_to_db(conn, fund, scheme_code)

    conn.close()
    return stats


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="PDF AMC Factsheet Engine — Extract mutual fund portfolio holdings",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"Registered AMC parsers: {', '.join(ParserFactory.list_parsers())}",
    )
    parser.add_argument("path", help="PDF file or directory of PDFs")
    parser.add_argument("--amc", help="Force AMC type (skip auto-detection)", default=None)
    parser.add_argument("--dry-run", action="store_true", help="Parse only, no DB writes")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    target = Path(args.path)
    if not target.exists():
        log.error(f"Path not found: {target}")
        sys.exit(1)

    # Collect PDF files
    if target.is_file():
        pdf_files = [target]
    else:
        pdf_files = sorted(target.glob("*.pdf")) + sorted(target.glob("*.PDF"))

    if not pdf_files:
        log.error(f"No PDF files found in {target}")
        sys.exit(1)

    log.info(f"Found {len(pdf_files)} PDF file(s)")
    log.info(f"Available parsers: {', '.join(ParserFactory.list_parsers())}")

    all_stats = []
    for pdf_file in pdf_files:
        stats = process_single_pdf(str(pdf_file), amc_override=args.amc, dry_run=args.dry_run)
        all_stats.append(stats)

    # Summary
    total_funds = sum(s.get("funds_found", 0) for s in all_stats)
    total_matched = sum(s.get("funds_matched", 0) for s in all_stats)
    total_unmatched = sum(s.get("funds_unmatched", 0) for s in all_stats)
    total_holdings = sum(s.get("holdings_imported", 0) for s in all_stats)
    errors = [s for s in all_stats if "error" in s]

    print(f"\n{'='*60}")
    print(f"  PDF AMC Engine — Summary")
    print(f"{'='*60}")
    print(f"  Files processed:    {len(pdf_files)}")
    print(f"  Funds found:        {total_funds}")
    print(f"  Funds matched:      {total_matched}")
    print(f"  Funds unmatched:    {total_unmatched}")
    print(f"  Holdings imported:  {total_holdings}")
    if errors:
        print(f"  Errors:             {len(errors)}")
        for e in errors:
            print(f"    - {e['file']}: {e['error']}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
