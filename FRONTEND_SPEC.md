# Frontend Specification

## Stack

| Concern | Library | Version |
|---------|---------|---------|
| Framework | React | 18 |
| Language | TypeScript | 5.x |
| Bundler | Vite | 5.x |
| PWA | vite-plugin-pwa | latest |
| State (client) | Zustand | 4.x |
| Server state | TanStack Query | 5.x |
| Styling | Tailwind CSS | 3.x |
| Gestures | @use-gesture/react | 10.x |
| Animation | react-spring | 9.x |
| Icons | lucide-react | latest |
| Routing | React Router | 6.x |
| Date utils | date-fns | 3.x |

---

## PWA requirements

`public/manifest.json`:
```json
{
  "name": "WeekendPlanner",
  "short_name": "Weekend",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fafaf8",
  "theme_color": "#1a1a18",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

`vite-plugin-pwa` config: `registerType: 'autoUpdate'`, cache static assets and API responses for `/activities` (stale-while-revalidate, 24h).

The app must be installable on iOS Safari and Android Chrome. Test with Lighthouse PWA audit.

---

## Session identity

On first load, generate a UUID v4 and store in `localStorage` as `session_id`.
Send as query param or body field on every API call — no auth required.

```typescript
// src/lib/utils.ts
export function getSessionId(): string {
  let id = localStorage.getItem('session_id');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('session_id', id); }
  return id;
}
```

---

## Global state (Zustand, persisted to localStorage)

```typescript
// src/store.ts
type DeckMode = 'events' | 'evergreen' | 'both';

interface AppStore {
  // Setup
  dateFrom: string;           // "YYYY-MM-DD"
  dateTo: string;
  activeCantons: Canton[];    // ["GE","VD","FR","VS","JU"]
  deckMode: DeckMode;         // default: 'events'

  // Swipe session
  deck: Activity[];           // merged activities + events
  deckIndex: number;
  currentBasket: Activity[];  // activities swiped up/right this session

  // Actions
  setDates(from: string, to: string): void;
  toggleCanton(id: Canton): void;
  setDeckMode(mode: DeckMode): void;
  setDeck(items: Activity[]): void;
  swipe(direction: 'yes' | 'up' | 'no'): void;
  addToBasket(activity: Activity): void;   // no-op if already present
  removeFromBasket(id: string): void;
  resetSession(): void;
}
```

The `persist` middleware stores `dateFrom`, `dateTo`, `activeCantons`, `deckMode`, and `currentBasket`. The `deck` and `deckIndex` are intentionally **not** persisted (they come from the API on each session load).

---

## Routing

```
/                → SetupPage
/swipe           → SwipePage
/basket          → BasketPage  (tabs: current / favourites / history)
/basket/:id      → BasketDetailPage (archived basket view)
```

Use `<Navigate>` to redirect `/` → `/swipe` if a non-empty `deck` is in the store.

---

## Pages

### SetupPage (`/`)

**Purpose:** pick weekend dates + canton filter + deck mode, then navigate to swipe deck.

**Layout (mobile):**
```
[Header: "Plan your weekend" + tagline]
[Date row: From | To]  ← two date inputs side by side
[Section label: "Cantons"]
[Canton pills row: GE VD FR VS JU — all on by default, toggleable]
[Section label: "Deck"]
[Deck mode pills: Events | Evergreen | Both]
[Deck mode sub-caption]
[CTA button: "Start swiping →"]
```

**Behaviour:**
- Default dates: next Saturday → Sunday (computed with `date-fns`).
- Default deck mode: `events`.
- At least 1 canton must remain active (prevent deselecting all).
- On "Start swiping": fetch `/activities?cantons=...` and/or `/events?date_from=...&date_to=...&cantons=...` in parallel, merge (events first, then evergreen sorted by `pref_score DESC`), truncate each pool to 20, navigate to `/swipe`.
- Show loading spinner during fetch; surface errors with an alert.

### SwipePage (`/swipe`)

**Purpose:** Tinder-style swipe through the deck.

**Layout (mobile):**
```
[Top bar: title "Discover" | "Basket (N)" pill button]
[Progress bar: 0–100% based on deckIndex/deck.length]
[Card stack: top card + 2 ghost cards behind, 3:4 aspect ratio]
[Action buttons: ✕ Pass | ↑ Basket | ♥ Favourite]
[Hint labels: Pass | Basket | Favourite]
```

**Card anatomy:**
```
[Photo: 16:10 aspect, object-cover, lazy loaded]
  [Type badge top-left: "This weekend" (amber) | "Evergreen" (green)]
  [Swipe overlays: FAVOURITE / PASS / IN BASKET — appear on drag]
[Card body:]
  [Title: 17px semibold]
  [Meta row: 📍 Canton | ⏱ Duration | 🏷 Tag chips]
  [Address: 2 lines, truncated]
  [Primary link: "View on myswitzerland.com" (events) | "Open in Maps" (evergreen)]
  [Secondary links: 🗺 Maps, ↗ Website]
```

**Swipe gestures (use-gesture + react-spring):**
- Drag horizontally → rotate card up to ±15deg
- Drag right > ~40px → green "FAVOURITE" overlay → vote('yes')
- Drag left < ~−40px → red "PASS" overlay → vote('no')
- Drag up > ~−40px → blue "IN BASKET" overlay → vote('up')
- Button taps call same vote() function
- Card animates off screen on confirm (flyOut left/right/up)
- Next card springs up from stack

**On vote:**
1. Update `deckIndex` in store.
2. POST `/prefs` with `{activity_id, direction, session_id}`.
3. If `direction === 'up'`: add to `currentBasket` in store.
4. If `direction === 'yes'`: add to `currentBasket` AND mark as favourite via the pref score.

**End of deck:**
- Show celebration screen: "All done!" with basket count.
- Primary button: "See your basket →" → navigate to `/basket`.
- Secondary button: "Plan a new weekend" → navigate to `/`.

**Basket shortcut:** tapping "Basket (N)" in top bar navigates to `/basket` mid-swipe. Returning to `/swipe` resumes at `deckIndex`.

### BasketPage (`/basket`)

**Purpose:** view current basket, favourites, and history.

**Layout:**
```
[Top bar: "Your basket" + "New weekend" button]
[Subtitle: date range]
[Tab bar: "This weekend (N)" | "Favourites (N)" | "History (N)"]
[Panel content below]
```

Each tab shows a live count chip in the tab bar.

**Tab: This weekend**

List of `currentBasket` activities:
```
[Thumbnail 56px] [Title + Canton · Duration] [📅 events] [🗺 maps] [↗ site] [🗑]
```
- Maps, website, and event-source icons open in new tab.
- Trash icon removes from basket (updates store only).
- Empty state: 🧺 + "No activities yet — swipe up to add things."
- Bottom CTA: "Archive & plan new weekend" → POST basket to `/baskets`, clear store, navigate to `/`.

**Tab: Favourites**

Activities where `prefs.score >= 2`, hydrated with full activity details fetched via `GET /activities?cantons=...` and filtered by id.
```
[Thumbnail 56px] [Title + Canton · Duration] [🗺 maps] [↑ add-to-basket]
```
- If no favourites: ♥ + "No favourites yet — swipe right on activities you love."
- If none match the current canton selection: "Couldn't find favourite activities in the current canton selection — try enabling more cantons."

**Tab: History**

List of archived baskets from `/baskets?session_id=...`:
```
[Date range]           [N activities]
[Activity 1 · Activity 2 · ...]
```
- Tapping the row navigates to `/basket/:id`.
- Inline "Delete" button removes the basket.

### BasketDetailPage (`/basket/:id`)

Read-only view of a single archived basket. Same `BasketItem` row layout as the "This weekend" tab minus the trash icon.

---

## Components

The pages currently co-locate their sub-components. When extracted, follow the names below.

### `<SwipeCard>`

Props: `activity: Activity, isTop: boolean, spring: SpringValues`
Renders the card. Photo uses `PhotoOrEmoji`. Maps + website links.

### `<PhotoOrEmoji>`

Props: `src?: string, alt: string, emoji: string`
Always renders an `<img>` with `onError` → emoji fallback. Used by `SwipeCard`.

### `<ThumbnailOrEmoji>`

Props: `src?: string | null, alt: string`
56×56 thumbnail variant of `PhotoOrEmoji` used in basket/favourite/history rows.

### `<ActionButton>`

Props: `label: string, symbol: string, color: 'red' | 'blue' | 'green', onClick: () => void`
64×64 circular button below the card with a label underneath.

### `<BasketItem>` / `<FavouriteItem>` / `<HistoryTab>`

Used in `BasketPage.tsx`.

---

## API client

```typescript
// src/api.ts
const BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export async function fetchActivities(cantons: Canton[], sessionId?: string): Promise<Activity[]>
export async function fetchEvents(dateFrom: string, dateTo: string, cantons: Canton[]): Promise<Activity[]>
export async function postPref(activityId: string, direction: Direction): Promise<void>
export async function saveBasket(dateFrom: string, dateTo: string, activityIds: string[]): Promise<Basket>
export async function fetchBaskets(): Promise<Basket[]>
export async function fetchBasket(id: string): Promise<Basket>
export async function deleteBasket(id: string): Promise<void>
export async function fetchFavourites(): Promise<{ activity_id: string; score: number }[]>
```

All functions read `getSessionId()` and inject it automatically.
Use `fetch` with `Content-Type: application/json`.
Throw typed errors on non-2xx responses.

---

## Vite config

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react(), VitePWA({ ... })],
  server: {
    proxy: {
      '/api': 'http://localhost:8002'
    }
  }
})
```

Proxy ensures no CORS issues in dev. In production, configure a reverse proxy (nginx or platform-level).

---

## Mobile-first design tokens

```css
/* Tailwind custom colours in tailwind.config.js */
colors: {
  bg:      '#fafaf8',   /* warm off-white */
  surface: '#f2f1ee',   /* card background */
  border:  '#e4e3de',   /* dividers */
  text:    '#1a1a18',   /* primary text */
  muted:   '#7a7971',   /* secondary text */
  green:   '#3b6d11',   /* favourite/evergreen */
  blue:    '#185fa5',   /* basket */
  red:     '#a32d2d',   /* pass */
  amber:   '#8b5a00',   /* event badge text */
}
```

Typography: system font stack (no Google Fonts in prod for privacy/perf).
`font-sans`: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

Minimum tap target: 44×44px for all interactive elements.
Max card width: 420px, centered on larger screens.
Bottom safe area: `padding-bottom: env(safe-area-inset-bottom)` on fixed bars.

---

## Types

```typescript
// src/lib/types.ts

export type Canton = 'GE' | 'VD' | 'FR' | 'VS' | 'JU';
export type Direction = 'yes' | 'up' | 'no';
export type ActivityType = 'evergreen' | 'event';

export interface OpeningHours {
  mon?: string; tue?: string; wed?: string;
  thu?: string; fri?: string; sat?: string; sun?: string;
}

export interface Activity {
  id: string;
  title: string;
  type: ActivityType;
  canton: Canton;
  address?: string;
  lat?: number;
  lng?: number;
  opening_hours?: OpeningHours;
  photo_url?: string;
  maps_url?: string;
  website?: string;
  tags: string[];
  duration_hint?: string;
  pref_score?: number;
  // event-only
  date_from?: string;
  date_to?: string;
  source_url?: string;
}

export interface Basket {
  id: string;
  session_id: string;
  date_from: string;
  date_to: string;
  activities: Activity[];
  created_at: string;
}
```
