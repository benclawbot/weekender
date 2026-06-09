# Frontend Domain

<!-- DOX-CHILD: frontend/ -->

## Purpose

Single-page application for the WeekendPlanner app. Provides swipe-based UI for building weekend activity baskets, basket management, and preference learning visualization.

## Ownership

- **Owns**: `frontend/` subtree
- **Owner**: Frontend team (default: all contributors)
- **Reports to**: Root AGENTS.md

## Local Contracts

### Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: React 18 + TypeScript
- **Build**: Vite 5
- **Styling**: Tailwind CSS 3
- **State**: Zustand (in-memory store)
- **PWA**: Vite PWA plugin (stale-while-revalidate)

### Page Contracts

| Page | File | Route | Notes |
|------|------|-------|-------|
| `SetupPage` | `src/pages/SetupPage.tsx` | `/` | Canton selection, session init |
| `SwipePage` | `src/pages/SwipePage.tsx` | `/swipe` | Card swiping, yes/no/super |
| `BasketPage` | `src/pages/BasketPage.tsx` | `/basket` | Current basket view |
| `BasketDetailPage` | `src/pages/BasketDetailPage.tsx` | `/basket/:id` | Archived basket view |

### Component Contracts

| Component | File | Owned By |
|-----------|------|----------|
| (none yet) | `src/components/` | This domain (stub for future components) |

### Library Contracts

| Module | File | Purpose |
|--------|------|---------|
| `api` | `src/api.ts` | Backend API client (fetch wrappers) |
| `types` | `src/lib/types.ts` | TypeScript interfaces |
| `utils` | `src/lib/utils.ts` | Shared utilities |
| `store` | `src/store.ts` | Zustand global state |

**Import path convention**: Root-level modules (`src/*.ts`) use `./lib/<module>` to import from `src/lib/`.

### API Integration

Frontend communicates with backend at `/api/v1` (configurable via `VITE_API_URL`).

| Endpoint Pattern | Used By |
|-----------------|---------|
| `GET /activities` | SwipePage |
| `GET /events` | SwipePage |
| `GET /baskets` | BasketPage |
| `POST /baskets` | SwipePage, BasketPage |
| `GET /baskets/:id` | BasketDetailPage |
| `DELETE /baskets/:id` | BasketPage |
| `GET /prefs` | SwipePage |
| `POST /prefs` | SwipePage |

### Environment Variables

| Variable | Source | Default |
|----------|--------|---------|
| `VITE_API_URL` | `frontend/.env` | `/api/v1` |

## Work Guidance

### Adding a New Page

1. Create `src/pages/<Name>Page.tsx`
2. Add route in `App.tsx`
3. Add page to local contracts table above

### Adding a Component

1. Create `src/components/<Name>.tsx`
2. Import in the appropriate page
3. Document in component contracts table above

### API Changes

When backend API changes:
1. Update `src/lib/api.ts` fetch wrappers
2. Update `src/lib/types.ts` TypeScript interfaces
3. Propagate to affected pages

## Verification

- `cd frontend && npm run dev` — dev server on port 5173
- `npm run build` — production build
- `npm run lint` — ESLint checks

## Running Locally (Development)

```bash
cd frontend
npm install   # first time only
npm run dev   # starts on http://localhost:5173
```

Requires backend running at `http://localhost:8000` (or set `VITE_API_URL` in `frontend/.env`).

## Child DOX Index

*Not yet populated.*