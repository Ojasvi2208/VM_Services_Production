#!/usr/bin/env python3
"""
CAS Parser Script
Uses the casparser library to parse CAS PDF files from CAMS/KFINTECH
Install: pip install casparser
"""

import sys
import json
import casparser
from datetime import datetime

def parse_cas(pdf_path: str, password: str = None) -> dict:
    """
    Parse a CAS PDF file and return structured JSON data
    """
    try:
        # Parse the CAS PDF
        data = casparser.read_cas_pdf(pdf_path, password=password)
        
        # Convert to our format
        result = {
            "success": True,
            "investorName": data.investor_info.name if data.investor_info else "",
            "email": data.investor_info.email if data.investor_info else "",
            "pan": "",
            "statementPeriod": {
                "from": data.statement_period.from_date.strftime("%d-%b-%Y") if data.statement_period else "",
                "to": data.statement_period.to_date.strftime("%d-%b-%Y") if data.statement_period else ""
            },
            "folios": [],
            "summary": {
                "totalFolios": 0,
                "totalSchemes": 0,
                "totalInvested": 0,
                "currentValue": 0
            }
        }
        
        # Extract PAN from investor info
        if data.investor_info and hasattr(data.investor_info, 'pan'):
            result["pan"] = data.investor_info.pan or ""
        
        # Process each folio
        for folio in data.folios:
            for scheme in folio.schemes:
                folio_data = {
                    "folioNumber": folio.folio or "",
                    "amc": folio.amc or "",
                    "schemeName": scheme.scheme or "",
                    "schemeCode": scheme.isin or scheme.amfi or "",
                    "pan": folio.pan or result["pan"],
                    "registrar": scheme.rta or "",
                    "closingBalance": float(scheme.close) if scheme.close else 0,
                    "closingNav": float(scheme.nav) if scheme.nav else 0,
                    "closingValue": float(scheme.valuation) if hasattr(scheme, 'valuation') and scheme.valuation else 0,
                    "costValue": float(scheme.cost_value) if hasattr(scheme, 'cost_value') and scheme.cost_value else 0,
                    "transactions": []
                }
                
                # Calculate value if not available
                if folio_data["closingValue"] == 0 and folio_data["closingBalance"] > 0 and folio_data["closingNav"] > 0:
                    folio_data["closingValue"] = folio_data["closingBalance"] * folio_data["closingNav"]
                
                # Process transactions
                for tx in scheme.transactions:
                    tx_type = "BUY"
                    desc_lower = tx.description.lower() if tx.description else ""
                    
                    if "redemption" in desc_lower or "redeem" in desc_lower:
                        tx_type = "REDEMPTION"
                    elif "sip" in desc_lower or "systematic" in desc_lower:
                        tx_type = "SIP"
                    elif "switch" in desc_lower and "in" in desc_lower:
                        tx_type = "SWITCH_IN"
                    elif "switch" in desc_lower and "out" in desc_lower:
                        tx_type = "SWITCH_OUT"
                    elif "dividend" in desc_lower:
                        tx_type = "DIVIDEND"
                    elif "swp" in desc_lower:
                        tx_type = "SWP"
                    elif tx.units and float(tx.units) < 0:
                        tx_type = "SELL"
                    
                    folio_data["transactions"].append({
                        "date": tx.date.strftime("%d-%b-%Y") if tx.date else "",
                        "description": tx.description or "",
                        "amount": abs(float(tx.amount)) if tx.amount else 0,
                        "units": abs(float(tx.units)) if tx.units else 0,
                        "nav": float(tx.nav) if tx.nav else 0,
                        "balance": float(tx.balance) if tx.balance else 0,
                        "type": tx_type
                    })
                
                result["folios"].append(folio_data)
                result["summary"]["currentValue"] += folio_data["closingValue"]
        
        result["summary"]["totalFolios"] = len(result["folios"])
        result["summary"]["totalSchemes"] = len(result["folios"])
        
        return result
        
    except Exception as e:
        error_msg = str(e)
        
        # Check for password errors
        if "password" in error_msg.lower() or "encrypted" in error_msg.lower():
            return {
                "success": False,
                "error": "This PDF is password protected. Please enter the correct password.",
                "requiresPassword": True
            }
        
        return {
            "success": False,
            "error": f"Failed to parse CAS: {error_msg}"
        }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No PDF path provided"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else None
    
    result = parse_cas(pdf_path, password)
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
