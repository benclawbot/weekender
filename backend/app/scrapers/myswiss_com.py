"""
myswitzerland.com event scraper.

Replaces the old agenda_ch scraper. We only pull events for the canton of
Vaud for now (the URL pattern the user tested and the one we know gets
through Cloudflare's Client Challenge in this environment). For other
cantons the scraper returns an empty list, which lets the API fall through
to the DB cache as before.

Each scraped event is enriched with the per-event page's og:image so the
swipe card can show a real photo from the myswitzerland.com CDN.
"""

import asyncio
import re
from datetime import datetime
from typing import Optional
import httpx


# Only Vaud for now. The URL slug was given by the user; other cantons
# (geneva-region, fribourg, valais, jura) hit the Cloudflare challenge
# much more aggressively from this network.
REGION_SLUGS = {
    "VD": "canton-of-vaud",
}

MAX_EVENTS_PER_CANTON = 20

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
REFERER = "https://www.myswitzerland.com/en-ch/"
LISTING_URL = (
    "https://www.myswitzerland.com/en-ch/experiences/events/events-search/"
    "-/{region}/?date_from={date_from}&date_to={date_to}&noidx=1"
)
EVENT_URL = "https://www.myswitzerland.com/en-ch/experiences/events/{slug}/"

# Slugs that aren't real events (e.g. listing / filter URLs).
_BAD_SLUGS = {"events-search", "events"}

# A page that came back as the Cloudflare Client Challenge is a tiny HTML
# shell. Real listing pages are 200-500KB, real per-event pages 250-260KB.
_CLIENT_CHALLENGE_MAX_LEN = 4096


def _is_client_challenge(html: str) -> bool:
    """Return True when the response was the Cloudflare anti-bot page."""
    if len(html) > _CLIENT_CHALLENGE_MAX_LEN:
        return False
    return "Client Challenge" in html


def _extract_event_slugs(html: str) -> list[str]:
    """Pull unique event-page slugs out of the listing HTML."""
    pattern = re.compile(
        r'href="https://www\.myswitzerland\.com/en-ch/experiences/events/'
        r'([a-z0-9][a-z0-9-]+)/?"',
        re.IGNORECASE,
    )
    seen: set[str] = set()
    out: list[str] = []
    for m in pattern.finditer(html):
        slug = m.group(1).lower()
        if slug in _BAD_SLUGS or slug in seen:
            continue
        seen.add(slug)
        out.append(slug)
    return out


_OG_IMAGE_RE = re.compile(
    r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
_OG_TITLE_RE = re.compile(
    r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)


def _extract_og(html: str, prop: str) -> Optional[str]:
    pattern = _OG_IMAGE_RE if prop == "image" else _OG_TITLE_RE
    m = pattern.search(html)
    return m.group(1) if m else None


def _clean_title(raw: str) -> str:
    """Strip the trailing ' | Switzerland Tourism' suffix that og:title has."""
    if not raw:
        return raw
    return re.sub(r"\s*\|\s*Switzerland Tourism\s*$", "", raw).strip()


async def _fetch(client: httpx.AsyncClient, url: str) -> Optional[str]:
    try:
        r = await client.get(url, headers={"Referer": REFERER})
        if r.status_code != 200:
            print(f"[myswiss] non-200 {r.status_code} for {url}")
            return None
        return r.text
    except Exception as e:
        print(f"[myswiss] fetch error for {url}: {e}")
        return None


async def _scrape_one_canton(
    client: httpx.AsyncClient,
    canton: str,
    region_slug: str,
    date_from: str,
    date_to: str,
) -> list[dict]:
    """Fetch the listing then up to MAX_EVENTS_PER_CANTON per-event pages."""
    listing_url = LISTING_URL.format(
        region=region_slug, date_from=date_from, date_to=date_to
    )
    html = await _fetch(client, listing_url)
    if not html:
        return []
    if _is_client_challenge(html):
        print(f"[myswiss] {canton} listing hit Client Challenge, skipping")
        return []

    slugs = _extract_event_slugs(html)[:MAX_EVENTS_PER_CANTON]
    if not slugs:
        print(f"[myswiss] {canton} listing had no event slugs")
        return []

    events: list[dict] = []
    for slug in slugs:
        await asyncio.sleep(0.6)  # be polite
        event_html = await _fetch(client, EVENT_URL.format(slug=slug))
        if not event_html or _is_client_challenge(event_html):
            # Skip silently — we already have other events for this canton
            continue

        og_image = _extract_og(event_html, "image")
        og_title = _extract_og(event_html, "title")
        title = _clean_title(og_title) if og_title else slug.replace("-", " ").title()
        per_event_url = EVENT_URL.format(slug=slug)

        # date_from/date_to for events: anchor to the requested window.
        # Per-event pages have precise dates but parsing them is out of
        # scope; the window filter on /events already matches the user's
        # selected weekend.
        try:
            df = datetime.fromisoformat(date_from)
            dt = datetime.fromisoformat(date_to)
        except ValueError:
            df = dt = None

        events.append(
            {
                "title": title,
                "type": "event",
                "canton": canton,
                "address": None,
                "lat": None,
                "lng": None,
                "photo_url": og_image,
                "maps_url": None,
                "website": None,
                "tags": ["event", "family"],
                "duration_hint": None,
                "date_from": df,
                "date_to": dt,
                "source_url": per_event_url,
            }
        )

    return events


async def scrape_events_for_cantons(
    date_from: str,
    date_to: str,
    cantons: list[str],
) -> list[dict]:
    """Public entry: scrape myswiss.com for the given cantons + date window.

    Only VD is wired up. Passing other cantons logs a warning and yields
    no events from the live scrape (the API can still serve cached events
    from the DB if any are present).
    """
    supported = [c for c in cantons if c.upper() in REGION_SLUGS]
    skipped = [c for c in cantons if c.upper() not in REGION_SLUGS]
    if skipped:
        print(
            f"[myswiss] cantons {skipped} are not yet supported by the live "
            f"scrape, only {[c.upper() for c in supported]} are"
        )

    if not supported:
        return []

    timeout = httpx.Timeout(20.0, connect=10.0)
    async with httpx.AsyncClient(
        timeout=timeout, follow_redirects=True, headers={"User-Agent": USER_AGENT}
    ) as client:
        results: list[dict] = []
        for canton in supported:
            canton_up = canton.upper()
            slug = REGION_SLUGS[canton_up]
            batch = await _scrape_one_canton(
                client, canton_up, slug, date_from, date_to
            )
            results.extend(batch)
        return results
