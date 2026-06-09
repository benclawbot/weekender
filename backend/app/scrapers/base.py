"""
Base scraper utilities — place name discovery from tourism sites.
Used for discovery only; Google Places handles structured data.
"""
import asyncio
import httpx
from bs4 import BeautifulSoup
from typing import Optional


async def discover_place_names(canton: str, url: str) -> list[str]:
    """
    Fetch a canton tourism page and extract activity place names.
    Returns list of strings suitable for Google Places text search.
    """
    headers = {
        "User-Agent": "WeekendPlannerBot/1.0 (family activity app; contact@weekendplanner.ch)"
    }

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            await asyncio.sleep(1.5)  # Respect polite scraping

            soup = BeautifulSoup(response.text, "html.parser")

            # Look for activity titles/cards - adapt selector per site
            titles = []
            # Try common patterns
            for tag in soup.find_all(["h3", "h2", "a"], class_=True):
                text = tag.get_text(strip=True)
                if text and len(text) > 3 and len(text) < 100:
                    titles.append(text)

            return titles[:30]  # Limit to avoid over-scraping

    except Exception as e:
        print(f"[discovery] Failed to fetch {url}: {e}")
        return []