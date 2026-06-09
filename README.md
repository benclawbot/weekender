# Weekender

A family activity recommendation app for Swiss weekends. Browse activities from Google Places, discover events from Agenda.ch, and swipe to build your perfect weekend basket.

## Tech Stack

- **Backend**: FastAPI + SQLAlchemy async + PostgreSQL
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **PWA**: Offline-capable with stale-while-revalidate caching
- **Learning**: Score-based preference system with tag affinity + novelty injection
- **Scrapers**: Google Places (quarterly) + Agenda.ch (on-demand, 6h cache)

## Quick Start

### 1. Backend (Docker)

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your values (API key already set)

docker compose up postgres backend -d
```

### 2. Seed activities

```bash
docker compose exec backend python -m app.scrapers.seed --cantons GE,VD,FR,VS,JU --limit 30
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@weekendplanner:5432/weekendplanner` | PostgreSQL connection string |
| `GOOGLE_PLACES_API_KEY` | *(required)* | Google Places API key |
| `SECRET_KEY` | `changeme` | Session secret |
| `ENVIRONMENT` | `development` | `development` or `production` |
| `EVENT_CACHE_TTL_HOURS` | `6` | Event cache duration |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `/api/v1` | Backend API base URL |

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/activities?cantons=...` | List evergreen activities |
| GET | `/api/v1/events?date_from=...&date_to=...&cantons=...` | List weekend events |
| GET | `/api/v1/baskets?session_id=...` | List user's baskets |
| POST | `/api/v1/baskets` | Archive current basket |
| GET | `/api/v1/baskets/:id` | Get archived basket |
| DELETE | `/api/v1/baskets/:id` | Delete basket |
| GET | `/api/v1/prefs?session_id=...` | Get preference scores |
| POST | `/api/v1/prefs` | Record a vote (yes/up/no) |

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