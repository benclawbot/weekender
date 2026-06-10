# Frontend Domain

<!-- DOX-CHILD: frontend/ -->

## Purpose

Single-page application for the WeekendPlanner app. Provides swipe-based UI for building weekend activity baskets, basket management, and preference learning.

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
- **State**: Zustand (persisted to localStorage)
- **Server state**: TanStack Query 5
- **Gestures/Animation**: @use-gesture/react, react-spring
- **PWA**: vite-plugin-pwa (stale-while-revalidate)

### Page Contracts

| Page | File | Route | Notes |
|------|------|-------|-------|
| `SetupPage` | `src/pages/SetupPage.tsx` | `/` | Date + canton + deck-mode picker. Defaults: next Sat→Sun, all 5 cantons, `events` mode. |
| `SwipePage` | `src/pages/SwipePage.tsx` | `/swipe` | Card swiping with drag (left=pass, right=favourite, up=basket). |
| `BasketPage` | `src/pages/BasketPage.tsx` | `/basket` | Tabs: This weekend / Favourites / History. |
| `BasketDetailPage` | `src/pages/BasketDetailPage.tsx` | `/basket/:id` | Read-only archived basket view. |

### In-file Component Patterns

Components currently live inside the page files (e.g. `SwipeCard`, `ActionButton`, `PhotoOrEmoji`, `ThumbnailOrEmoji`, `BasketItem`, `FavouriteItem`, `HistoryTab` in `BasketPage.tsx`). When extracted, follow the convention below.

### Component Contracts

| Component | Where | Purpose |
|-----------|-------|---------|
| `SwipeCard` | `SwipePage.tsx` | Card UI with photo, badge, swipe overlays. Bound to a spring. |
| `ActionButton` | `SwipePage.tsx` | Pass / Basket / Favourite button below the card. |
| `PhotoOrEmoji` | `SwipePage.tsx` | Card photo with `onError` fallback to tag-emoji. |
| `ThumbnailOrEmoji` | `BasketPage.tsx`, `BasketDetailPage.tsx` | 56px thumbnail variant of `PhotoOrEmoji`. |
| `BasketItem` | `BasketPage.tsx` | Single activity row in the "This weekend" tab. |
| `FavouriteItem` | `BasketPage.tsx` | Single activity row in the "Favourites" tab. |
| `HistoryTab` | `BasketPage.tsx` | List of archived baskets. |

### Library Contracts

| Module | File | Purpose |
|--------|------|---------|
| `api` | `src/api.ts` | Backend API client (fetch wrappers) |
| `types` | `src/lib/types.ts` | TypeScript interfaces (`Activity`, `Basket`, `Canton`, `OpeningHours`, etc.) |
| `utils` | `src/lib/utils.ts` | `getSessionId`, `clsx` |
| `store` | `src/store.ts` | Zustand global state — see "Global State" below |

**Import path convention**: `src/lib/*` for shared libs, `src/api.ts` for the client, `src/store.ts` for state.

### Global State (Zustand)

Persisted to `localStorage` under `weekend-store` (`dateFrom`, `dateTo`, `activeCantons`, `deckMode`, `currentBasket`).

| Field | Type | Notes |
|-------|------|-------|
| `dateFrom`, `dateTo` | `string` (YYYY-MM-DD) | Set on Setup, used for the events API call. |
| `activeCantons` | `Canton[]` | Defaults to all 5. Toggle prevents deselecting all. |
| `deckMode` | `'events' \| 'evergreen' \| 'both'` | Defaults to `'events'`. |
| `deck`, `deckIndex`, `currentBasket` | `Activity[]` | In-memory only (`deck` is the in-session list). |

### Deck Composition (in `SetupPage.handleStart`)

- Truncates each pool to 20.
- Events first, then evergreen sorted by `pref_score DESC`.
- `setDeck(merged)` puts the list in the store; `SwipePage` reads `deck.slice(deckIndex)`.

### API Integration

Frontend communicates with backend at `/api/v1` (configurable via `VITE_API_URL`).

| Endpoint Pattern | Used By |
|-----------------|---------|
| `GET /activities` | `SetupPage`, `BasketPage` (favourites hydration) |
| `GET /events` | `SetupPage` |
| `POST /prefs` | `SwipePage` |
| `GET /prefs` | `BasketPage` (favourites) |
| `POST /baskets` | `BasketPage` (archive) |
| `GET /baskets` | `BasketPage` (history) |
| `DELETE /baskets/:id` | `BasketPage` (history) |
| `GET /baskets/:id` | `BasketDetailPage` |
| `PATCH /baskets/:id/activities/:activity_id` | reserved — current UI uses local store removal |

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

1. Create `src/components/<Name>.tsx` (or co-locate in the page until it grows)
2. Import in the appropriate page
3. Document in component contracts table above

### API Changes

When backend API changes:
1. Update `src/api.ts` fetch wrappers
2. Update `src/lib/types.ts` TypeScript interfaces
3. Propagate to affected pages

## Verification

- `cd frontend && npm run dev` — dev server on port 5173
- `npm run build` — production build (`tsc && vite build`)
- `npm run preview` — serve production build locally

## Running Locally (Development)

```bash
cd frontend
npm install   # first time only
npm run dev   # starts on http://localhost:5173
```

Requires backend running at `http://localhost:8002` (or set `VITE_API_URL` in `frontend/.env`).

## Child DOX Index

*Not yet populated.*