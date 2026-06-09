# Scraping Specification

## Philosophy

- Evergreen activities: scraped **once**, refreshed **quarterly**. Source of truth is Google Places API (structured, reliable, photos included). Canton tourism sites are secondary sources for discovery only.
- Weekend events: scraped **on demand** per session load, cached 6h in memory. Primary source is Agenda.ch.
- All scrapers are **idempotent** — upsert by stable key, never duplicate.
- Scraper failures are **non-fatal** — log and return stale data rather than crashing.

---

## 1. Evergreen scraper — Google Places API

**File:** `backend/app/scrapers/google_places.py`

### Flow

```
For each canton in [GE, VD, FR, VS, JU]:
  For each search_query in canton_queries[canton]:
    → places.searchText(query, locationBias=canton_bbox)
    For each place in results:
      → places.getDetails(place_id, fields=[name, address, location,
          opening_hours, photos, website, editorial_summary])
      → geocode address if lat/lng missing
      → download first photo (max 800px wide) or keep URL reference
      → upsert into activities table
```

### Canton search queries

```python
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
```

### Canton bounding boxes (for locationBias)

```python
CANTON_BBOXES = {
    "GE": {"low": {"lat": 46.10, "lng": 5.95}, "high": {"lat": 46.38, "lng": 6.30}},
    "VD": {"low": {"lat": 46.18, "lng": 6.10}, "high": {"lat": 47.00, "lng": 7.18}},
    "FR": {"low": {"lat": 46.42, "lng": 6.80}, "high": {"lat": 47.05, "lng": 7.48}},
    "VS": {"low": {"lat": 45.87, "lng": 6.75}, "high": {"lat": 46.65, "lng": 8.48}},
    "JU": {"low": {"lat": 47.13, "lng": 6.82}, "high": {"lat": 47.52, "lng": 7.57}},
}
```

### Google Places API details

- API version: **Places API (New)** — `places.googleapis.com/v1`
- Method: `POST https://places.googleapis.com/v1/places:searchText`
- Detail fetch: `GET https://places.googleapis.com/v1/places/{place_id}`
- Required fields mask: `places.id,places.displayName,places.formattedAddress,places.location,places.regularOpeningHours,places.photos,places.websiteUri,places.editorialSummary`
- Photo: fetch first photo ref at max 800px — `GET https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=800&key=...`
- Rate limit: 600 requests/minute on free tier. Add `asyncio.sleep(0.12)` between requests.
- Auth: `X-Goog-Api-Key` header.

### Tag inference

Infer tags from Google `types` field:

```python
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
```

Always add `"family"` tag to all activities (app is family-focused).

### Upsert key

`google_place_id` — unique per place. On conflict: update `title, address, lat, lng, opening_hours, photo_url, website, tags, last_scraped_at`.

### Running manually

```bash
cd backend
python -m app.scrapers.google_places
# Logs: scraped N activities across 5 cantons
```

### Schedule

APScheduler cron job: every 90 days, runs at 03:00 local time.

---

## 2. Secondary discovery — Canton tourism sites

Used **only for discovery** (finding place names to feed into Google Places).
Not for structured data extraction — Google Places handles that.

| Canton | URL | Approach |
|--------|-----|----------|
| Geneva | `https://www.geneve-tourisme.ch/activites/` | Parse `<h3>` activity titles, feed to Google Places search |
| Vaud | `https://www.vaudtourisme.ch/fr/activites/` | Parse activity card titles |
| Fribourg | `https://www.fribourgregion.ch/fr/` | Parse listing titles |
| Valais | `https://www.valais.ch/fr/activites` | Parse activity titles |
| Jura | `https://www.juratourisme.ch/activites` | Parse listing titles |

**Implementation:** `backend/app/scrapers/base.py` — `discover_place_names(canton, url) -> list[str]`

Use `httpx.AsyncClient` with:
```python
headers = {
    "User-Agent": "WeekendPlannerBot/1.0 (family activity app; contact@yourapp.ch)"
}
```

Respect `robots.txt`. Add `await asyncio.sleep(1.5)` between page requests.
If a site blocks scraping, fall back to Google Places text search only.

---

## 3. Events scraper — Agenda.ch

**File:** `backend/app/scrapers/agenda_ch.py`

### Target URL pattern

```
https://www.agenda.ch/fr/evenements/?date_from={YYYY-MM-DD}&date_to={YYYY-MM-DD}&region={region_slug}
```

### Region slugs

```python
AGENDA_REGIONS = {
    "GE": "geneve",
    "VD": "vaud",
    "FR": "fribourg",
    "VS": "valais",
    "JU": "jura",
}
```

Run one request per selected canton.

### HTML selectors (verify on first run — site may change)

```python
EVENT_LIST_SELECTOR = "div.event-list article.event-item"
TITLE_SELECTOR      = "h2.event-title a"
DATE_SELECTOR       = "time[datetime]"          # attr: datetime="YYYY-MM-DD"
LOCATION_SELECTOR   = "span.event-location"
LINK_SELECTOR       = "h2.event-title a[href]"
IMAGE_SELECTOR      = "img.event-image[src]"
```

If selectors break, fall back to returning an empty list and log a warning. Never crash.

### Flow

```
For each canton in selected_cantons:
  url = build_url(canton, date_from, date_to)
  html = await httpx.get(url)
  events = parse_events(html, canton)
  for event in events:
    geocode address → lat/lng (Google Geocoding API or Nominatim fallback)
    upsert into events table (key: title + date_from + canton)
```

### Geocoding fallback

Primary: Google Geocoding API (`maps.googleapis.com/maps/api/geocode/json?address=...&key=...`)
Fallback: Nominatim (`nominatim.openstreetmap.org/search?q=...&format=json`) — rate limit 1 req/s.
If both fail: store `lat=None, lng=None`. Maps link still works via address string.

### Cache

In `backend/app/services/event_service.py`:

```python
_cache: dict[str, tuple[list, datetime]] = {}
CACHE_TTL = timedelta(hours=6)

def get_cache_key(date_from, date_to, cantons):
    return f"{date_from}_{date_to}_{'_'.join(sorted(cantons))}"
```

On `/events` request:
1. Check `_cache[key]` — if exists and `now() < expiry`, return cached.
2. Else: run scraper, store in cache and DB, return results.

### Cleanup job

APScheduler: daily at 02:00, delete all events where `date_to < now() - 7 days`.

---

## 4. Error handling

| Scenario | Behaviour |
|----------|-----------|
| Google Places API key missing | Raise `RuntimeError` on startup, log clearly |
| Google Places quota exceeded | Log warning, return partial results, continue |
| Agenda.ch unreachable | Log warning, return empty events list, don't block app load |
| Selector mismatch on agenda.ch | Log warning with URL, return empty, alert developer |
| Geocoding fails | Store `lat=None`, continue — maps_url still works via address |
| DB connection lost during scrape | Retry 3x with exponential backoff, then log and abort |

---

## 5. Manual seed script

`backend/app/scrapers/seed.py` — wraps the Google Places scraper with a CLI:

```bash
python -m app.scrapers.seed --cantons GE,VD,FR,VS,JU --limit 50
# --limit: max activities per canton (default 50)
# --dry-run: print without writing to DB
```

Expected output after full seed: ~150–250 activities across all cantons.
