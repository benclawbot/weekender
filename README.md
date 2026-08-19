<p align="center">
  <img src="assets/weekender-banner.svg" alt="Weekender" width="100%" />
</p>

# Weekender

A family activity recommendation app for Swiss weekends. Browse evergreen activities, discover time-bound events from myswitzerland.com, and swipe to build your perfect weekend basket. The app learns from your votes and re-orders the deck to surface what your family actually likes.

## Tech Stack

- **Backend**: FastAPI + SQLAlchemy async + SQLite (dev) / PostgreSQL (Docker/prod)
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **State**: Zustand (persisted) + TanStack Query (server state)
- **PWA**: Offline-capable with stale-while-revalidate caching
- **Learning**: Score-based preference system with favourites floor and novelty injection
- **Scrapers**:
  - **Evergreen**: Google Places API (quarterly, runs on APScheduler) + a 80-activity local seeder for development
  - **Events**: myswitzerland.com live scrape, on-demand with 6h in-memory cache and DB fallback

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # or: .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env       # edit if you need a Google API key
python -m uvicorn app.main:app --port 8002
```

The first start auto-seeds 80 activities (5 cantons × 16) from `seed_local.py` if the table is empty — no Google API key required. Set `ENVIRONMENT=development` in `.env` to keep the auto-seed on.

To use Google Places instead (or as a refresh), run:

```bash
docker compose up postgres backend -d
docker compose exec backend python -m app.scrapers.seed --cantons GE,VD,FR,VS,JU --limit 30
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` to `http://localhost:8002`.

### 3. Production build

```bash
cd frontend
npm run build
```

Outputs to `frontend/dist/`.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///weekendplanner.db` | PostgreSQL URL in Docker (`postgresql+asyncpg://...`) |
| `GOOGLE_PLACES_API_KEY` | *(empty)* | Required only for the live `google_places` scraper |
| `SECRET_KEY` | `changeme` | Session secret |
| `ENVIRONMENT` | `development` | `development` triggers auto-seed on empty DB |
| `EVENT_CACHE_TTL_HOURS` | `6` | In-memory cache TTL for the events endpoint |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `/api/v1` | Backend API base URL |

## App Tour

- **Setup page** (`/`): pick weekend dates, toggle cantons, choose what to swipe (`events`, `evergreen`, or `both`).
- **Swipe page** (`/swipe`): drag right to favourite, left to pass, up to add to the basket. Each card has a real photo, a 16:10 image, type badge, swipe feedback overlays, and primary/secondary links.
- **Basket page** (`/basket`): three tabs:
  - *This weekend* — the current session's basket, with archive CTA.
  - *Favourites* — every activity you've swiped right on (`score >= 2`), filtered to the active cantons.
  - *History* — every archived basket; tap to view its detail page.
- **Basket detail** (`/basket/:id`): read-only view of an archived basket.

The learning system stores one row per (session, activity) with a score: `+2` favourite, `+1` basket, `−1` pass (floor: `−5`; favourite floor: `2`). It also injects a random unseen activity every 5th position so the deck never goes stale.

## API Routes

All routes prefixed `/api/v1`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/activities?cantons=...&session_id=...` | List evergreen activities |
| GET | `/events?date_from=...&date_to=...&cantons=...` | List weekend events (live myswiss.com + DB fallback) |
| GET | `/baskets?session_id=...` | List archived baskets |
| POST | `/baskets` | Archive current basket |
| GET | `/baskets/:id` | Get archived basket |
| DELETE | `/baskets/:id` | Delete basket |
| PATCH | `/baskets/:id/activities/:activity_id` | Remove activity from basket |
| GET | `/prefs?session_id=...` | Get preference scores |
| POST | `/prefs` | Record a vote (`yes` / `up` / `no`) |

Static photo uploads are served at `/uploads/photos/<filename>`.

## Deployment

### Vercel (Frontend)

Configure in GitHub repo Settings → Secrets:

- `VERCEL_TOKEN` — Vercel personal access token
- `VERCEL_ORG_ID` — Vercel org ID
- `VERCEL_PROJECT_ID` — Vercel project ID
- `VITE_API_URL` — Production API URL (e.g. `https://api.yourdomain.com/api/v1`)

Push to `main` → GitHub Actions deploys automatically.

### Railway / Render / Fly.io (Backend)

1. Build: `docker build -t weekend-backend .`
2. Set `DATABASE_URL` and `GOOGLE_PLACES_API_KEY` environment variables
3. Run: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

## Documentation

- [`AGENTS.md`](AGENTS.md) — root DOX contract
- [`backend/AGENTS.md`](backend/AGENTS.md) — backend domain contracts
- [`frontend/AGENTS.md`](frontend/AGENTS.md) — frontend domain contracts
- [`SCRAPING_SPEC.md`](SCRAPING_SPEC.md) — scraper philosophy + reference
- [`FRONTEND_SPEC.md`](FRONTEND_SPEC.md) — page, component, and state contracts
- [`LEARNING_MODEL.md`](LEARNING_MODEL.md) — preference scoring and deck ordering
