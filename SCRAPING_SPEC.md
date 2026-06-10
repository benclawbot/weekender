# Scraping Specification

## Philosophy

- Evergreen activities: scraped **once**, refreshed **quarterly**. Source of truth is Google Places API (structured, reliable, photos included). Canton tourism sites are secondary sources for discovery only.
- Weekend events: scraped **on demand** per session load, cached 6h in memory. Primary source is myswitzerland.com (Agenda.ch was retired — Cloudflare protection and brittle selectors).
- All scrapers are **idempotent** — upsert by stable key, never duplicate.
- Scraper failures are **non-fatal** — log and fall through to stale data (events) or skip (evergreen) rather than crashing.

---

## 1. Evergreen scraper — Google Places API

**File:** `backend/app/scrapers/google_places.py`

### Flow

```
For each canton in [GE, VD, FR, VS, JU]:
  For each search_query in canton_queries[canton]:
    → places.searchText(query, location=center+radius)
    For each place in results:
      → places.getDetails(place_id, fields=[name, address, location,
          opening_hours, photos, website, types])
      → download first photo (max 800px wide) to uploads/photos/
      → upsert into activities table by google_place_id
```

### Canton search queries & centres

Centres (lat, lng) are used with a 50km radius for `location` biasing. See `CANTON_QUERIES` and `CANTON_CENTERS` in the source file.

### Google Places API details

- Endpoint: `maps.googleapis.com/maps/api/place/textsearch/json`
- Detail endpoint: `maps.googleapis.com/maps/api/place/details/json`
- Fields mask: `place_id,name,formatted_address,geometry,opening_hours,photos,website,types`
- Photo: `maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=...&key=...` → saved locally
- Rate limit: 600 requests/minute on free tier. `asyncio.sleep(0.12)` between requests.
- Auth: `key=` query param.

### Tag inference

`GOOGLE_TYPE_TO_TAGS` maps Google place `types` to our tag list (museum, outdoor, family, paid/free, etc.). `"family"` is always added.

### Upsert key

`google_place_id` — unique per place. On conflict: update `title, address, lat, lng, opening_hours, photo_path, website, tags, last_scraped_at`.

### Running manually

```bash
cd backend
python -m app.scrapers.google_places
# Logs: scraped N activities across N cantons
```

### Schedule

APScheduler interval job: every 90 days (interval trigger because cron `*/90` is invalid).

---

## 2. Local evergreen seeder — `seed_local.py`

**File:** `backend/app/scrapers/seed_local.py`

Used in development / when no Google API key is set. The `app/main.py` lifespan auto-runs this on first start if the activities table is empty.

### Dataset

- 80 hardcoded activities: 16 per canton × 5 cantons.
- Each activity may include a `wiki_key`; resolved via `backend/wiki_photos.json` to a Wikimedia Commons `photo_url`. Activities without a key still appear, but the card shows the tag-emoji fallback.

### Refresh strategy

The seeder **wipes and re-inserts** the activities table — it is local-dev-only. The committed `wiki_photos.json` ships real image URLs for ~30 of the activities; the rest rely on the emoji fallback.

### Manual run

```bash
cd backend
python -m app.scrapers.seed_local
```

---

## 3. Events scraper — myswitzerland.com

**File:** `backend/app/scrapers/myswiss_com.py`

Replaced the old Agenda.ch scraper. myswiss.com provides stable URLs and `og:image` tags for each event page, which we use as the swipe-card photo.

### Supported cantons

Currently only **VD** is wired up; other cantons are skipped with a console log and the events path falls through to the DB cache. Region slug for Vaud: `canton-of-vaud`.

```python
REGION_SLUGS = {"VD": "canton-of-vaud"}
MAX_EVENTS_PER_CANTON = 20
```

### Listing + per-event pages

```
LISTING_URL = https://www.myswitzerland.com/en-ch/experiences/events/events-search/-/{region}/?date_from=...&date_to=...&noidx=1
EVENT_URL   = https://www.myswitzerland.com/en-ch/experiences/events/{slug}/
```

Flow per canton:
1. Fetch listing. If body looks like a Cloudflare client-challenge (`len < 4096` and `"Client Challenge"` in HTML), skip.
2. Extract event-page slugs from anchor `href`s.
3. For each slug (max 20), fetch the per-event page (with 0.6s delay). If that's a client-challenge page, skip.
4. Pull `og:image` and `og:title` from the event page. `og:title` has a `| Switzerland Tourism` suffix that we strip.

### Cache

In `backend/app/services/event_service.py`:

```python
_events_cache: dict[str, tuple[list, datetime]] = {}
CACHE_TTL = timedelta(hours=6)

def _cache_key(date_from, date_to, cantons):
    return f"{date_from}_{date_to}_{'_'.join(sorted(cantons))}"
```

On `/events`:
1. Check cache.
2. Else call `myswiss_com.scrape_events_for_cantons(...)`.
3. On any failure, fall back to `_query_db_events(...)` so the local-dev experience still works with whatever events are already persisted.

### Cleanup job

APScheduler: daily at 02:00, delete events where `date_to < now() - 7 days`.

---

## 4. Legacy scraper — Agenda.ch

**File:** `backend/app/scrapers/agenda_ch.py`

Kept for reference / future reactivation. Not wired into the live `/events` path. BeautifulSoup selectors targeted the old Agenda.ch markup which has since changed (and the site returns Cloudflare challenges from many networks).

---

## 5. Error handling

| Scenario | Behaviour |
|----------|-----------|
| Google Places API key missing | `run_google_places_scraper` raises `RuntimeError`; `seed_local` is the fallback used at startup |
| Google Places quota exceeded | Log warning, return partial results, continue |
| myswiss.com listing returns Cloudflare challenge | Log warning, return empty list for that canton |
| myswiss.com per-event page returns Cloudflare challenge | Skip that event silently |
| Geocoding fails | Store `lat=None`, continue — maps_url still works via address |
| DB connection lost during scrape | Bubble up to the APScheduler wrapper, which logs and continues |

---

## 6. Manual seed scripts

- `python -m app.scrapers.seed --cantons GE,VD,FR,VS,JU --limit 50` — wraps the Google Places scraper with a CLI.
- `python -m app.scrapers.seed_local` — runs the 80-activity static seeder (the default in dev).

