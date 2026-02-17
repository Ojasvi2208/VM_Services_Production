#!/usr/bin/env python3
"""
CAS Parser Script — Production-grade parser for Akshaya Fintech
Uses casparser library (Pydantic v2 models) to parse CAMS/KFINTECH/NSDL CAS PDFs.

Install: pip install casparser

Outputs JSON to stdout matching the server's ParsedCAS interface:
  { success, investorName, email, pan, statementPeriod, folios[], summary }
"""

import sys
import json
import traceback
from datetime import date, datetime
from decimal import Decimal

import casparser
from casparser.types import CASData, NSDLCASData
from casparser.enums import TransactionType


def dec(val) -> float:
    """Safely convert Decimal/float/None → float."""
    if val is None:
        return 0.0
    return float(val)


def fmt_date(d) -> str:
    """Format date object or string → DD-MMM-YYYY."""
    if isinstance(d, date):
        return d.strftime("%d-%b-%Y")
    return str(d) if d else ""


TX_TYPE_MAP = {
    TransactionType.PURCHASE: "BUY",
    TransactionType.PURCHASE_SIP: "SIP",
    TransactionType.REDEMPTION: "REDEMPTION",
    TransactionType.SWITCH_IN: "SWITCH_IN",
    TransactionType.SWITCH_IN_MERGER: "SWITCH_IN",
    TransactionType.SWITCH_OUT: "SWITCH_OUT",
    TransactionType.SWITCH_OUT_MERGER: "SWITCH_OUT",
    TransactionType.DIVIDEND_PAYOUT: "DIVIDEND",
    TransactionType.DIVIDEND_REINVEST: "DIVIDEND",
    TransactionType.STT_TAX: "BUY",
    TransactionType.STAMP_DUTY_TAX: "BUY",
    TransactionType.TDS_TAX: "BUY",
    TransactionType.SEGREGATION: "BUY",
    TransactionType.REVERSAL: "SELL",
    TransactionType.MISC: "BUY",
    TransactionType.UNKNOWN: "BUY",
}


def classify_tx(tx_type, description: str, units) -> str:
    """Map casparser TransactionType → our simplified type."""
    mapped = TX_TYPE_MAP.get(tx_type, None)
    if mapped:
        return mapped
    # Fallback: description-based
    d = (description or "").lower()
    if "sip" in d or "systematic investment" in d:
        return "SIP"
    if "redemption" in d or "redeem" in d:
        return "REDEMPTION"
    if "switch" in d and "in" in d:
        return "SWITCH_IN"
    if "switch" in d and "out" in d:
        return "SWITCH_OUT"
    if "swp" in d or "systematic withdrawal" in d:
        return "SWP"
    if "dividend" in d:
        return "DIVIDEND"
    if units is not None and float(units) < 0:
        return "SELL"
    return "BUY"


def parse_cas_mf(data: CASData) -> dict:
    """Parse CAMS/KFINTECH CAS (mutual fund statements)."""
    result = {
        "success": True,
        "investorName": data.investor_info.name if data.investor_info else "",
        "email": data.investor_info.email if data.investor_info else "",
        "pan": "",
        "statementPeriod": {
            "from": fmt_date(data.statement_period.from_) if data.statement_period else "",
            "to": fmt_date(data.statement_period.to) if data.statement_period else "",
        },
        "folios": [],
        "summary": {
            "totalFolios": 0,
            "totalSchemes": 0,
            "totalInvested": 0,
            "currentValue": 0,
        },
    }

    for folio in data.folios:
        folio_pan = folio.PAN or ""
        if folio_pan and not result["pan"]:
            result["pan"] = folio_pan

        for scheme in folio.schemes:
            # schemeCode: prefer AMFI code (numeric, matches our funds DB), then ISIN
            scheme_code = scheme.amfi or scheme.isin or ""

            # Valuation is a SchemeValuation object with .nav, .value, .cost
            closing_nav = dec(scheme.valuation.nav) if scheme.valuation else 0.0
            closing_value = dec(scheme.valuation.value) if scheme.valuation else 0.0
            cost_value = dec(scheme.valuation.cost) if scheme.valuation else 0.0

            folio_data = {
                "folioNumber": folio.folio or "",
                "amc": folio.amc or "",
                "schemeName": scheme.scheme or "",
                "schemeCode": scheme_code,
                "pan": folio_pan or result["pan"],
                "registrar": scheme.rta or "",
                "closingBalance": dec(scheme.close),
                "closingNav": closing_nav,
                "closingValue": closing_value,
                "costValue": cost_value,
                "transactions": [],
            }

            # Calculate value if not available
            if folio_data["closingValue"] == 0 and folio_data["closingBalance"] > 0 and closing_nav > 0:
                folio_data["closingValue"] = folio_data["closingBalance"] * closing_nav

            # Process transactions
            total_invested = 0.0
            for tx in scheme.transactions:
                tx_type = classify_tx(tx.type, tx.description, tx.units)
                amount = abs(dec(tx.amount))
                units = abs(dec(tx.units))

                folio_data["transactions"].append({
                    "date": fmt_date(tx.date),
                    "description": tx.description or "",
                    "amount": amount,
                    "units": units,
                    "nav": dec(tx.nav),
                    "balance": dec(tx.balance),
                    "type": tx_type,
                })

                if tx_type in ("BUY", "SIP", "SWITCH_IN"):
                    total_invested += amount

            if cost_value == 0 and total_invested > 0:
                folio_data["costValue"] = total_invested

            result["folios"].append(folio_data)
            result["summary"]["currentValue"] += folio_data["closingValue"]
            result["summary"]["totalInvested"] += folio_data["costValue"] or total_invested

    result["summary"]["totalFolios"] = len(set(f["folioNumber"] for f in result["folios"]))
    result["summary"]["totalSchemes"] = len(result["folios"])

    return result


def parse_cas_nsdl(data: NSDLCASData) -> dict:
    """Parse NSDL/CDSL demat CAS (equities + MFs in demat)."""
    result = {
        "success": True,
        "investorName": data.investor_info.name if data.investor_info else "",
        "email": data.investor_info.email if data.investor_info else "",
        "pan": "",
        "statementPeriod": {
            "from": fmt_date(data.statement_period.from_) if data.statement_period else "",
            "to": fmt_date(data.statement_period.to) if data.statement_period else "",
        },
        "folios": [],
        "summary": {
            "totalFolios": 0,
            "totalSchemes": 0,
            "totalInvested": 0,
            "currentValue": 0,
        },
    }

    for account in data.accounts:
        # Extract PAN from owners
        for owner in account.owners:
            if owner.PAN and not result["pan"]:
                result["pan"] = owner.PAN

        # Mutual funds in demat
        for mf in account.mutual_funds:
            folio_data = {
                "folioNumber": mf.folio or mf.isin or "",
                "amc": "",
                "schemeName": mf.name or f"Fund {mf.isin}",
                "schemeCode": mf.isin or "",
                "pan": result["pan"],
                "registrar": "NSDL",
                "closingBalance": dec(mf.balance),
                "closingNav": dec(mf.nav),
                "closingValue": dec(mf.value),
                "costValue": dec(mf.total_cost),
                "transactions": [],
            }
            result["folios"].append(folio_data)
            result["summary"]["currentValue"] += folio_data["closingValue"]

    result["summary"]["totalFolios"] = len(result["folios"])
    result["summary"]["totalSchemes"] = len(result["folios"])

    return result


def parse_cas(pdf_path: str, password: str = None) -> dict:
    """Parse a CAS PDF file and return structured JSON data."""
    try:
        data = casparser.read_cas_pdf(pdf_path, password=password)

        if isinstance(data, NSDLCASData):
            return parse_cas_nsdl(data)
        else:
            return parse_cas_mf(data)

    except Exception as e:
        error_msg = str(e)
        tb = traceback.format_exc()

        if "password" in error_msg.lower() or "encrypted" in error_msg.lower():
            return {
                "success": False,
                "error": "This PDF is password protected. Please enter the correct password.",
                "requiresPassword": True,
            }

        return {
            "success": False,
            "error": f"Failed to parse CAS: {error_msg}",
            "trace": tb[:500],
        }


class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        if isinstance(o, (date, datetime)):
            return o.strftime("%d-%b-%Y")
        return super().default(o)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No PDF path provided"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else None

    result = parse_cas(pdf_path, password)
    print(json.dumps(result, ensure_ascii=False, cls=DecimalEncoder))


if __name__ == "__main__":
    main()
