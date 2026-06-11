"""
Google Places scraper for evergreen activities (v3 API).
Downloads photos to local storage.
"""
import asyncio
import os
import uuid
import httpx
from datetime import datetime
from typing import Optional

from app.config import get_settings

settings = get_settings()

BASE_URL = "https://maps.googleapis.com/maps/api/place"


CANTON_QUERIES = {
    "GE": [
        "family activities Geneva Switzerland",
        "museums Geneva Switzerland",
        "parks Geneva Switzerland",
        "nature walks Geneva Switzerland",
        "children attractions Geneva Switzerland",
    ],
    "VD": [
        "family activities Vaud Switzerland",
        "châteaux Vaud Switzerland",
        "museums Lausanne Switzerland",
        "nature parks Vaud Switzerland",
        "family attractions Montreux Switzerland",
        "family attractions Nyon Switzerland",
    ],
    "FR": [
        "family activities Fribourg Switzerland",
        "Gruyères tourist attractions",
        "museums Fribourg Switzerland",
        "nature activities Fribourg Switzerland",
    ],
    "VS": [
        "family activities Valais Switzerland",
        "nature parks Valais Switzerland",
        "family mountain activities Valais",
        "museums Valais Switzerland",
        "Zermatt family activities",
    ],
    "JU": [
        "family activities Jura Switzerland",
        "hiking Franches-Montagnes",
        "nature Jura Switzerland",
        "museums Jura Switzerland",
    ],
}

# Bbox centers for each canton (lat, lng)
CANTON_CENTERS = {
    "GE": (46.24, 6.13),
    "VD": (46.59, 6.64),
    "FR": (46.74, 7.14),
    "VS": (46.26, 7.62),
    "JU": (47.33, 7.20),
}

GOOGLE_TYPE_TO_TAGS = {
    "museum": ["museum", "indoor", "culture"],
    "park": ["outdoor", "nature", "family"],
    "zoo": ["animals", "outdoor", "family"],
    "aquarium": ["animals", "indoor", "family"],
    "amusement_park": ["outdoor", "family", "paid"],
    "tourist_attraction": ["culture"],
    "natural_feature": ["outdoor", "nature", "hiking"],
    "castle": ["history", "castle", "culture"],
    "art_gallery": ["indoor", "culture", "art"],
    "church": ["history", "culture"],
    "beach": ["outdoor", "beach", "water"],
    "campground": ["outdoor", "nature"],
    "hiking_area": ["outdoor", "hiking", "nature"],
    "ski_resort": ["outdoor", "mountain", "paid"],
    "water_park": ["outdoor", "water", "family", "paid"],
    "playground": ["outdoor", "playground", "family", "free"],
    "library": ["indoor", "free", "family"],
    "botanical_garden": ["outdoor", "nature", "family"],
}


def _tags_from_types(google_types: list[str]) -> list[str]:
    tags = []
    for t in google_types:
        if t in GOOGLE_TYPE_TO_TAGS:
            tags.extend(GOOGLE_TYPE_TO_TAGS[t])
    if "family" not in tags:
        tags.append("family")
    return list(set(tags))


async def _download_photo(photo_ref: str, activity_id: str) -> Optional[str]:
    """Download photo and save to local storage. Returns local path."""
    api_key = settings.google_places_api_key
    if not api_key:
        return None

    photos_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))), settings.photos_dir
    )
    os.makedirs(photos_dir, exist_ok=True)

    url = f"{BASE_URL}/photo?maxwidth=800&photo_reference={photo_ref}&key={api_key}"

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
            content_type = response.headers.get("content-type", "image/jpeg")
            ext = "jpg"
            if "png" in content_type:
                ext = "png"
            elif "webp" in content_type:
                ext = "webp"

            filename = f"{activity_id}.{ext}"
            filepath = os.path.join(photos_dir, filename)
            with open(filepath, "wb") as f:
                f.write(response.content)
            return filename
    except Exception as e:
        print(f"[photo] Failed to download {photo_ref}: {e}")
        return None


async def _search_places(query: str, lat: float, lng: float, api_key: str) -> list[dict]:
    """Search Google Places v3 API for a query near a location."""
    url = f"{BASE_URL}/textsearch/json"
    params = {
        "query": query,
        "location": f"{lat},{lng}",
        "radius": 50000,  # 50km
        "key": api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return data.get("results", [])
    except Exception as e:
        print(f"[places] Search failed for '{query}': {e}")
        return []


async def _get_place_details(place_id: str, api_key: str) -> Optional[dict]:
    """Fetch detailed info for a single place via v3 API."""
    url = f"{BASE_URL}/details/json"
    params = {
        "place_id": place_id,
        "fields": "place_id,name,formatted_address,geometry,opening_hours,photos,website,types",
        "key": api_key,
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return data.get("result")
    except Exception as e:
        print(f"[places] Detail fetch failed for {place_id}: {e}")
        return None


def _opening_hours_to_dict(opening_hours: dict) -> Optional[dict]:
    """Convert v3 opening_hours periods to {day: time} dict."""
    periods = opening_hours.get("periods", [])
    if not periods:
        return None
    days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    result = {}
    for period in periods:
        open_info = period.get("open", {})
        day = open_info.get("day")
        time = open_info.get("time")
        if day is not None and time:
            result[days[day]] = time[:4] + ":" + time[4:]
    return result if result else None


async def _build_maps_url(address: str) -> str:
    """Build a Google Maps search URL from an address."""
    encoded = address.replace(" ", "+")
    return f"https://www.google.com/maps/search/?api=1&query={encoded}"


async def run_google_places_scraper(cantons: Optional[list[str]] = None) -> list[dict]:
    """
    Run the full Google Places scraper for specified cantons.
    Returns list of activity dicts ready for upsert.
    """
    api_key = settings.google_places_api_key
    if not api_key:
        raise RuntimeError("GOOGLE_PLACES_API_KEY is not set")

    cantons = cantons or list(CANTON_QUERIES.keys())
    results = []

    for canton in cantons:
        queries = CANTON_QUERIES.get(canton, [])
        center = CANTON_CENTERS.get(canton)
        if not center:
            continue
        lat, lng = center

        for query in queries:
            places = await _search_places(query, lat, lng, api_key)
            await asyncio.sleep(0.12)  # Rate limit

            for place in places:
                place_id = place.get("place_id")
                if not place_id:
                    continue

                details = await _get_place_details(place_id, api_key)
                await asyncio.sleep(0.12)

                if not details:
                    continue

                activity_id = str(uuid.uuid4())

                # Download photo
                photo_path = None
                photos = details.get("photos", [])
                if photos:
                    photo_ref = photos[0].get("photo_reference")
                    if photo_ref:
                        photo_path = await _download_photo(photo_ref, activity_id)

                # Build maps URL
                address = details.get("formatted_address", "")
                maps_url = await _build_maps_url(address) if address else None

                opening_hours = None
                if details.get("opening_hours"):
                    opening_hours = _opening_hours_to_dict(details["opening_hours"])

                tags = _tags_from_types(details.get("types", []))

                location = details.get("geometry", {}).get("location", {})

                activity = {
                    "id": activity_id,
                    "google_place_id": place_id,
                    "title": details.get("name", query),
                    "type": "evergreen",
                    "canton": canton,
                    "address": address,
                    "lat": location.get("lat"),
                    "lng": location.get("lng"),
                    "opening_hours": opening_hours,
                    "photo_path": photo_path,
                    "maps_url": maps_url,
                    "website": details.get("website"),
                    "tags": tags,
                    "last_scraped_at": datetime.utcnow(),
                }
                results.append(activity)

    return results


if __name__ == "__main__":
    import asyncio

    results = asyncio.run(run_google_places_scraper())
    print(f"Scraped {len(results)} activities across cantons")
