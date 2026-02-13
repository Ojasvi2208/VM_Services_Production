#!/usr/bin/env python3
"""
Fuel Price Scraper for Akshaya — scrapes goodreturns.in daily.
Runs via GitHub Action at 6:15 AM IST (00:45 UTC).
Posts scraped data to our backend for storage.
"""

import cloudscraper
from bs4 import BeautifulSoup
import json
import sys
import os
from datetime import datetime

BACKEND_URL = os.environ.get("BACKEND_URL", "https://www.vmfinancialservices.com")
SCRAPE_SECRET = os.environ.get("FUEL_SCRAPE_SECRET", "")

BASE_URL = "https://www.goodreturns.in"

# Cities to scrape individually (slug → display name)
# These get city-specific daily prices from dedicated pages
CITY_SLUGS = {
    "sas-nagar": "Mohali",
    "pune": "Pune",
    "ahmedabad": "Ahmedabad",
    "surat": "Surat",
    "indore": "Indore",
    "nagpur": "Nagpur",
    "visakhapatnam": "Visakhapatnam",
    "coimbatore": "Coimbatore",
    "kochi": "Kochi",
    "ludhiana": "Ludhiana",
    "amritsar": "Amritsar",
    "vadodara": "Vadodara",
    "bhopal": "Bhopal",
    "raipur": "Raipur",
    "ranchi": "Ranchi",
    "dehradun": "Dehradun",
    "guwahati": "Guwahati",
    "agra": "Agra",
    "varanasi": "Varanasi",
    "kanpur": "Kanpur",
    "jodhpur": "Jodhpur",
    "udaipur": "Udaipur",
    "mysore": "Mysore",
    "mangalore": "Mangalore",
    "madurai": "Madurai",
    "shimla": "Shimla",
}


def create_scraper():
    return cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "windows", "mobile": False}
    )


def parse_main_page(scraper, fuel_type):
    """Scrape the main petrol/diesel page for metro cities + state prices."""
    url = f"{BASE_URL}/{fuel_type}-price.html"
    r = scraper.get(url, timeout=20)
    if r.status_code != 200:
        print(f"  ❌ {fuel_type} main page: HTTP {r.status_code}")
        return {}, {}

    soup = BeautifulSoup(r.content, "html.parser")
    tables = soup.find_all("table")

    cities = {}
    states = {}

    for i, table in enumerate(tables):
        target = cities if i == 0 else states
        for row in table.find_all("tr"):
            cols = row.find_all("td")
            if len(cols) >= 3:
                name = cols[0].get_text(strip=True)
                price_text = (
                    cols[1].get_text(strip=True).replace("₹", "").replace(" ", "").replace(",", "")
                )
                change = cols[2].get_text(strip=True)
                try:
                    target[name] = {"price": float(price_text), "change": change}
                except ValueError:
                    pass

    print(f"  ✅ {fuel_type} main: {len(cities)} metro cities, {len(states)} states")
    return cities, states


def parse_city_page(scraper, slug, fuel_type):
    """Scrape a city-specific page for today's price."""
    url = f"{BASE_URL}/{fuel_type}-price-in-{slug}.html"
    try:
        r = scraper.get(url, timeout=15)
        if r.status_code != 200:
            return None

        soup = BeautifulSoup(r.content, "html.parser")

        # City pages have a different structure — first table row is today's price
        # Format: ['February 12, 2026', '₹98.55', '+0.32']
        tables = soup.find_all("table")
        for table in tables:
            rows = table.find_all("tr")
            for row in rows:
                cols = row.find_all("td")
                if len(cols) >= 3:
                    date_text = cols[0].get_text(strip=True)
                    price_text = (
                        cols[1].get_text(strip=True).replace("₹", "").replace(" ", "").replace(",", "")
                    )
                    change = cols[2].get_text(strip=True)

                    # Check if this looks like a date row (today's price)
                    today = datetime.now()
                    if str(today.year) in date_text or "February" in date_text or today.strftime("%B") in date_text:
                        try:
                            return {"price": float(price_text), "change": change}
                        except ValueError:
                            pass

        # Fallback: try the page title for price
        title = soup.find("title")
        if title:
            title_text = title.get_text(strip=True)
            # Title format: "Petrol Price in Sas Nagar, ... Rs. 98.33/Ltr"
            import re
            match = re.search(r"Rs\.?\s*([\d.]+)", title_text)
            if match:
                return {"price": float(match.group(1)), "change": "0.00"}

        return None
    except Exception as e:
        print(f"  ⚠️  {slug} {fuel_type}: {e}")
        return None


def parse_cng_main(scraper):
    """Scrape CNG main page for metro cities + state prices."""
    url = f"{BASE_URL}/cng-price.html"
    r = scraper.get(url, timeout=20)
    if r.status_code != 200:
        print(f"  ❌ CNG main page: HTTP {r.status_code}")
        return {}, {}

    soup = BeautifulSoup(r.content, "html.parser")
    tables = soup.find_all("table")
    cities = {}
    states = {}

    for i, table in enumerate(tables[:2]):  # table 0 = cities, table 1 = states
        target = cities if i == 0 else states
        for row in table.find_all("tr"):
            cols = row.find_all("td")
            if len(cols) >= 3:
                name = cols[0].get_text(strip=True)
                price_text = cols[1].get_text(strip=True).replace("₹", "").replace(" ", "").replace(",", "")
                try:
                    target[name] = float(price_text)
                except ValueError:
                    pass

    print(f"  ✅ CNG main: {len(cities)} metro cities, {len(states)} states")
    return cities, states


def parse_lpg_main(scraper):
    """Scrape LPG main page for metro cities + state domestic prices."""
    url = f"{BASE_URL}/lpg-price.html"
    r = scraper.get(url, timeout=20)
    if r.status_code != 200:
        print(f"  ❌ LPG main page: HTTP {r.status_code}")
        return {}, {}

    soup = BeautifulSoup(r.content, "html.parser")
    tables = soup.find_all("table")
    cities = {}
    states = {}

    for i, table in enumerate(tables[:2]):
        target = cities if i == 0 else states
        for row in table.find_all("tr"):
            cols = row.find_all("td")
            if len(cols) >= 2:
                name = cols[0].get_text(strip=True)
                # Domestic price is in col 1, may have "( 0.00 )" change suffix
                raw = cols[1].get_text(strip=True).replace("₹", "").replace(",", "")
                # Extract just the price number before any parenthetical
                import re
                m = re.match(r"([\d.]+)", raw)
                if m:
                    try:
                        target[name] = float(m.group(1))
                    except ValueError:
                        pass

    print(f"  ✅ LPG main: {len(cities)} metro cities, {len(states)} states")
    return cities, states


def parse_cng_city_page(scraper, slug):
    """Get CNG price from city-specific page (title fallback)."""
    url = f"{BASE_URL}/cng-price-in-{slug}.html"
    try:
        r = scraper.get(url, timeout=15)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.content, "html.parser")
        title = soup.find("title")
        if title:
            import re
            m = re.search(r"Rs\.?\s*([\d.]+)", title.get_text(strip=True))
            if m:
                return float(m.group(1))
        return None
    except Exception:
        return None


def parse_lpg_city_page(scraper, slug):
    """Get LPG domestic price from city-specific page."""
    url = f"{BASE_URL}/lpg-price-in-{slug}.html"
    try:
        r = scraper.get(url, timeout=15)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.content, "html.parser")
        title = soup.find("title")
        if title:
            import re
            m = re.search(r"Rs\.?\s*([\d.]+)", title.get_text(strip=True))
            if m:
                return float(m.group(1))
        return None
    except Exception:
        return None


def scrape_all():
    """Full scrape: metro cities, states, specific cities — petrol, diesel, CNG, LPG."""
    scraper = create_scraper()
    result = {
        "cities": {},       # slug → {name, petrol, diesel, cng, lpg, ...}
        "states": {},       # state name → {petrol, diesel, cng, lpg, ...}
        "fetchedAt": datetime.utcnow().isoformat() + "Z",
        "source": "goodreturns.in",
    }

    # ── Petrol + Diesel ──
    print("📊 Scraping petrol + diesel main pages...")
    petrol_cities, petrol_states = parse_main_page(scraper, "petrol")
    diesel_cities, diesel_states = parse_main_page(scraper, "diesel")

    # ── CNG + LPG ──
    print("⛽ Scraping CNG + LPG main pages...")
    cng_cities, cng_states = parse_cng_main(scraper)
    lpg_cities, lpg_states = parse_lpg_main(scraper)

    # Merge metro cities (petrol + diesel + cng + lpg)
    all_city_names = set(petrol_cities.keys()) | set(diesel_cities.keys()) | set(cng_cities.keys()) | set(lpg_cities.keys())
    for name in all_city_names:
        p = petrol_cities.get(name, {})
        d = diesel_cities.get(name, {})
        slug = name.lower().replace(" ", "-")
        result["cities"][slug] = {
            "name": name,
            "petrol": p.get("price", 0),
            "diesel": d.get("price", 0),
            "petrolChange": p.get("change", "0.00"),
            "dieselChange": d.get("change", "0.00"),
            "cng": cng_cities.get(name, 0),
            "lpg": lpg_cities.get(name, 0),
        }

    # Merge states
    all_state_names = set(petrol_states.keys()) | set(diesel_states.keys()) | set(cng_states.keys()) | set(lpg_states.keys())
    for name in all_state_names:
        p = petrol_states.get(name, {})
        d = diesel_states.get(name, {})
        result["states"][name] = {
            "petrol": p.get("price", 0),
            "diesel": d.get("price", 0),
            "petrolChange": p.get("change", "0.00"),
            "dieselChange": d.get("change", "0.00"),
            "cng": cng_states.get(name, 0),
            "lpg": lpg_states.get(name, 0),
        }

    # Scrape individual city pages (petrol + diesel + CNG + LPG)
    print(f"\n🏙️  Scraping {len(CITY_SLUGS)} city-specific pages...")
    for slug, display_name in CITY_SLUGS.items():
        existing = result["cities"].get(slug)
        if existing and existing.get("petrol", 0) > 0:
            # Already have petrol/diesel from metro list, just add CNG/LPG
            if existing.get("cng", 0) == 0:
                existing["cng"] = parse_cng_city_page(scraper, slug) or 0
            if existing.get("lpg", 0) == 0:
                existing["lpg"] = parse_lpg_city_page(scraper, slug) or 0
            print(f"  ⏭️  {display_name} already in metro, added CNG={existing['cng']} LPG={existing['lpg']}")
            continue

        petrol_data = parse_city_page(scraper, slug, "petrol")
        diesel_data = parse_city_page(scraper, slug, "diesel")
        cng_price = parse_cng_city_page(scraper, slug) or 0
        lpg_price = parse_lpg_city_page(scraper, slug) or 0

        if petrol_data or diesel_data:
            result["cities"][slug] = {
                "name": display_name,
                "petrol": petrol_data["price"] if petrol_data else 0,
                "diesel": diesel_data["price"] if diesel_data else 0,
                "petrolChange": petrol_data.get("change", "0.00") if petrol_data else "0.00",
                "dieselChange": diesel_data.get("change", "0.00") if diesel_data else "0.00",
                "cng": cng_price,
                "lpg": lpg_price,
            }
            print(f"  ✅ {display_name}: P₹{result['cities'][slug]['petrol']} D₹{result['cities'][slug]['diesel']} CNG₹{cng_price} LPG₹{lpg_price}")
        else:
            print(f"  ❌ {display_name}: no data found")

    return result


def post_to_backend(data):
    """POST scraped data to our backend for storage."""
    import requests

    url = f"{BACKEND_URL}/api/cron/update-fuel-scraped"
    headers = {"Content-Type": "application/json"}
    if SCRAPE_SECRET:
        headers["x-scrape-secret"] = SCRAPE_SECRET

    try:
        r = requests.post(url, json=data, headers=headers, timeout=30)
        print(f"\n📤 POST to backend: {r.status_code}")
        print(f"   Response: {r.text[:200]}")
        return r.status_code == 200
    except Exception as e:
        print(f"\n❌ POST failed: {e}")
        return False


def main():
    print("=" * 60)
    print(f"🔥 Akshaya Fuel Price Scraper — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    data = scrape_all()

    print(f"\n📊 Summary:")
    print(f"   Cities: {len(data['cities'])}")
    print(f"   States: {len(data['states'])}")

    # Show key cities
    for slug in ["sas-nagar", "new-delhi", "chandigarh"]:
        city = data["cities"].get(slug)
        if city:
            print(f"   {city['name']}: P₹{city['petrol']} D₹{city['diesel']} CNG₹{city.get('cng',0)} LPG₹{city.get('lpg',0)}")

    # Save locally for debugging
    with open("/tmp/akshaya-fuel-scraped.json", "w") as f:
        json.dump(data, f, indent=2)
    print(f"\n💾 Saved to /tmp/akshaya-fuel-scraped.json")

    # Post to backend
    if BACKEND_URL:
        success = post_to_backend(data)
        sys.exit(0 if success else 1)
    else:
        print("\n⚠️  No BACKEND_URL set, skipping POST")
        print(json.dumps(data, indent=2))


if __name__ == "__main__":
    main()
