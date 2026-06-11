# Backend Domain

<!-- DOX-CHILD: backend/ -->

## Purpose

Backend API service for the WeekendPlanner app. Provides REST endpoints for activities, events, baskets, and user preferences. Manages PostgreSQL/SQLite database, scraping schedulers, and learning-based recommendation scoring.

## Ownership

- **Owns**: `backend/` subtree, `backend/app/` Python package
- **Owner**: Backend team (default: all contributors)
- **Reports to**: Root AGENTS.md

## Local Contracts

### Tech Stack

- **Runtime**: Python 3.11+
- **Framework**: FastAPI (async)
- **ORM**: SQLAlchemy 2.x (async)
- **Database**: SQLite (aiosqlite) in development; PostgreSQL (asyncpg) in Docker/production
- **Scheduler**: APScheduler (scraper scheduling)
- **Validation**: Pydantic v2

### API Contracts

All routes prefixed `/api/v1`:

| Method | Path | File | Notes |
|--------|------|------|-------|
| GET | `/health` | `app/main.py` | Health check |
| GET | `/activities` | `app/api/activities.py` | List evergreen activities (filters by canton, session_id) |
| GET | `/events` | `app/api/events.py` | List weekend events (live scrape + DB fallback) |
| GET | `/baskets` | `app/api/baskets.py` | List archived baskets for a session |
| POST | `/baskets` | `app/api/baskets.py` | Archive current basket |
| GET | `/baskets/:id` | `app/api/baskets.py` | Get archived basket |
| DELETE | `/baskets/:id` | `app/api/baskets.py` | Delete basket |
| PATCH | `/baskets/:id/activities/:activity_id` | `app/api/baskets.py` | Remove activity from basket |
| GET | `/prefs` | `app/api/prefs.py` | Get pref scores for a session |
| POST | `/prefs` | `app/api/prefs.py` | Record a vote (yes/up/no) |

Static uploads served at `/uploads/photos/<filename>` (mounted in `app/main.py`).

### Data Models (`app/models/activity.py`)

| Model | Notes |
|-------|-------|
| `Activity` | Single table for both evergreen activities and events. Distinguished by `type` column. `photo_url` (remote) and `photo_path` (local upload) are mutually supporting; `ActivityService.photo_url_for` picks the right one. |
| `Pref` | One row per (session_id, activity_id); unique constraint + index. |
| `Basket` | Archived basket header. |
| `BasketActivity` | Many-to-many join between baskets and activities. |

### Services (`app/services/`)

| Service | Role |
|---------|------|
| `ActivityService` | Query/upsert activities; sort deck by learning model; resolve `photo_url_for()`. |
| `EventService` | Live myswiss.com scrape with 6h in-memory cache; DB fallback for offline. |

### Scraper Contracts (`app/scrapers/`)

| Scraper | Source | Cadence | Photo source |
|---------|--------|---------|--------------|
| `google_places` | Google Places v3 API | Quarterly via APScheduler | Local download to `uploads/photos/` |
| `myswiss_com` | myswitzerland.com events | On-demand with 6h cache | `og:image` from event pages |
| `seed_local` | Static dataset (`ACTIVITIES` + `wiki_photos.json`) | Auto-run on empty DB | Wikipedia Commons URLs |

`agenda_ch.py` is kept as legacy/optional but no longer wired into the events path.

### Environment Variables (`backend/.env`)

| Variable | Default | Required |
|----------|---------|----------|
| `DATABASE_URL` | `sqlite+aiosqlite:///weekendplanner.db` | No |
| `GOOGLE_PLACES_API_KEY` | empty | No (scraper skips if empty; `seed_local` works without) |
| `SECRET_KEY` | `changeme` | No |
| `ENVIRONMENT` | `development` | No |
| `EVENT_CACHE_TTL_HOURS` | `6` | No |
| `photos_dir` | `uploads/photos` | No (relative to `backend/`) |

## Work Guidance

### Adding a New API Router

1. Create `app/api/<name>.py` with FastAPI router
2. Add Pydantic schemas in `app/schemas.py` or `app/schemas/<name>.py`
3. Import and include router in `app/main.py`
4. Document route in Local Contracts table above

### Adding a New Model

1. Create `app/models/<name>.py` with SQLAlchemy model
2. Import in `app/models/__init__.py`
3. Ensure `app/database.py` imports all models before `Base.metadata.create_all`

### Adding a New Scraper

1. Create `app/scrapers/<name>.py`
2. Register in `app/scrapers/__init__.py`
3. Add scheduler job in `app/scrapers/scheduler.py` (if periodic)

### Activity Photos

Google Places photos are downloaded to `uploads/photos/` and exposed through `/uploads/photos/<filename>`. Run `python -m app.scrapers.backfill_photos` after importing activity rows that have Google Place IDs but no local or remote photo.

## Verification

- `pytest backend/tests/` — unit tests
- `python -m uvicorn app.main:app --port 8002` — start backend locally (SQLite). Vite dev proxy points here.
- `docker compose up postgres backend -d` — start services (PostgreSQL, exposed on 8000)
- `python -m app.scrapers.seed_local` — seed local activities on first run (auto-seeded in development)

## Running Locally (Development)

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8002
```

Backend runs at `http://localhost:8002`. Uses SQLite (`weekendplanner.db`) by default. The dev environment auto-seeds 80 activities (5 cantons × 16) on first start when the activities table is empty.

## Child DOX Index

*Not yet populated. Child AGENTS.md files may be added for `app/scrapers/` if scraper logic grows complex enough to warrant separate ownership.*
