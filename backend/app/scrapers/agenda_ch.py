"""
Agenda.ch scraper for weekend events.
"""
import asyncio
import re
import httpx
from bs4 import BeautifulSoup
from datetime import datetime
from typing import Optional

from app.config import get_settings

settings = get_settings()


AGENDA_REGIONS = {
    "GE": "geneve",
    "VD": "vaud",
    "FR": "fribourg",
    "VS": "valais",
    "JU": "jura",
}

EVENT_LIST_SELECTOR = "div.event-list article.event-item"
TITLE_SELECTOR = "h2.event-title a"
DATE_SELECTOR = "time[datetime]"
LOCATION_SELECTOR = "span.event-location"
LINK_SELECTOR = "h2.event-title a[href]"
IMAGE_SELECTOR = "img.event-image[src]"


async def _fetch_agenda_page(
    date_from: str,
    date_to: str,
    region_slug: str,
) -> Optional[str]:
    """Fetch a single agenda.ch canton page."""
    url = f"https://www.agenda.ch/fr/evenements/?date_from={date_from}&date_to={date_to}&region={region_slug}"
    headers = {
        "User-Agent": "WeekendPlannerBot/1.0 (family activity app; contact@weekendplanner.ch)"
    }
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.text
    except Exception as e:
        print(f"[agenda] Failed to fetch {url}: {e}")
        return None


def _parse_events(html: str, canton: str) -> list[dict]:
    """Parse events from agenda.ch HTML."""
    soup = BeautifulSoup(html, "html.parser")
    events = []

    items = soup.select(EVENT_LIST_SELECTOR)
    if not items:
        print(f"[agenda] No events found with selector {EVENT_LIST_SELECTOR}")
        return []

    for item in items:
        title_el = item.select_one(TITLE_SELECTOR)
        date_el = item.select_one(DATE_SELECTOR)
        location_el = item.select_one(LOCATION_SELECTOR)
        link_el = item.select_one(LINK_SELECTOR)
        image_el = item.select_one(IMAGE_SELECTOR)

        title = title_el.get_text(strip=True) if title_el else None
        link = link_el.get("href") if link_el else None
        date_str = date_el.get("datetime") if date_el else None
        location = location_el.get_text(strip=True) if location_el else None
        image_url = image_el.get("src") if image_el else None

        if not title:
            continue

        date_from = None
        if date_str:
            try:
                date_from = datetime.fromisoformat(date_str[:10])
            except ValueError:
                pass

        event = {
            "title": title,
            "type": "event",
            "canton": canton,
            "address": location,
            "source_url": link,
            "photo_url": image_url,
            "date_from": date_from,
            "date_to": date_from,
            "tags": ["event", "family"],
            "duration_hint": None,
        }
        events.append(event)

    return events


async def _geocode_address(address: str) -> tuple[Optional[float], Optional[float]]:
    """Geocode via Nominatim fallback. Returns (lat, lng)."""
    if not address:
        return None, None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"https://nominatim.openstreetmap.org/search?q={address}&format=json&limit=1"
            headers = {"User-Agent": "WeekendPlannerBot/1.0"}
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            if data:
                return float(data[0].get("lat")), float(data[0].get("lon"))
    except Exception as e:
        print(f"[geocode] Failed for '{address}': {e}")

    return None, None


async def scrape_events_for_cantons(
    date_from: str,
    date_to: str,
    cantons: list[str],
) -> list[dict]:
    """Main entry point: scrape events for all selected cantons."""
    all_events = []

    for canton in cantons:
        region_slug = AGENDA_REGIONS.get(canton.upper())
        if not region_slug:
            continue

        html = await _fetch_agenda_page(date_from, date_to, region_slug)
        if not html:
            continue

        await asyncio.sleep(1.5)  # Respect polite scraping

        events = _parse_events(html, canton.upper())

        for event in events:
            # Try to geocode address
            if event.get("address") and not event.get("lat"):
                lat, lng = await _geocode_address(event["address"])
                event["lat"] = lat
                event["lng"] = lng
                await asyncio.sleep(1.1)  # Nominatim rate limit

            all_events.append(event)

    return all_events