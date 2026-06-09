# Backend Domain

<!-- DOX-CHILD: backend/ -->

## Purpose

Backend API service for the WeekendPlanner app. Provides REST endpoints for activities, events, baskets, and user preferences. Manages PostgreSQL database, scraping schedulers, and learning-based recommendation scoring.

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

| Router | File | Owned By |
|--------|------|----------|
| `activities` | `app/api/activities.py` | This domain |
| `events` | `app/api/events.py` | This domain |
| `baskets` | `app/api/baskets.py` | This domain |
| `prefs` | `app/api/prefs.py` | This domain |

### Data Models

| Model | File | Notes |
|-------|------|-------|
| `Activity` | `app/models/activity.py` | Evergreen activities from Google Places |
| `Event` | (inline in service) | Agenda.ch events with TTL cache |
| `Basket` | `app/api/baskets.py` | Archived activity/event collections |
| `PreferenceVote` | `app/api/prefs.py` | Yes/No votes for learning system |

### Scraper Contracts

| Scraper | Source | Schedule |
|---------|--------|----------|
| `google_places` | Google Places API | Quarterly (APScheduler) |
| `agenda_ch` | Agenda.ch | On-demand, 6h TTL |

### Environment Variables

| Variable | Source | Required |
|----------|--------|----------|
| `DATABASE_URL` | `backend/.env` | Yes |
| `GOOGLE_PLACES_API_KEY` | `backend/.env` | Yes |
| `SECRET_KEY` | `backend/.env` | Yes |
| `ENVIRONMENT` | `backend/.env` | No (default: development) |
| `EVENT_CACHE_TTL_HOURS` | `backend/.env` | No (default: 6) |

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

1. Create `app/scrapers/<name>.py` extending `BaseScraper`
2. Register in `app/scrapers/__init__.py`
3. Add scheduler job in `app/scrapers/scheduler.py`

## Verification

- `pytest backend/tests/` — unit tests
- `python -m uvicorn app.main:app --port 8000` — start backend locally (SQLite)
- `docker compose up postgres backend -d` — start services (PostgreSQL)
- `docker compose exec backend python -m app.scrapers.seed` — seed data

## Running Locally (Development)

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Backend runs at `http://localhost:8000`. Uses SQLite (`weekendplanner.db`) by default.

## Child DOX Index

*Not yet populated. Child AGENTS.md files may be added for `app/scrapers/` if scraper logic grows complex enough to warrant separate ownership.*