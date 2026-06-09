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

`vite-plugin-pwa` config: `registerType: 'autoUpdate'`, cache all static assets and API responses for `/activities` (stale-while-revalidate, 24h).

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

## Global state (Zustand)

```typescript
// src/store.ts
interface AppStore {
  // Setup
  dateFrom: string;           // "YYYY-MM-DD"
  dateTo: string;
  activeCantons: string[];    // ["GE","VD","FR","VS","JU"]

  // Swipe session
  deck: Activity[];           // merged activities + events, sorted by pref
  deckIndex: number;
  currentBasket: Activity[];  // activities swiped up this session

  // Prefs (local mirror of DB)
  prefs: Record<string, number>; // activity_id → score

  // Actions
  setDates(from: string, to: string): void;
  toggleCanton(id: string): void;
  setDeck(items: Activity[]): void;
  swipe(direction: 'yes' | 'up' | 'no'): void;
  removeFromBasket(id: string): void;
  resetSession(): void;
}
```

---

## Routing

```
/                → SetupPage
/swipe           → SwipePage
/basket          → BasketPage  (tabs: current / favourites / history)
/basket/:id      → BasketDetailPage (archived basket view)
```

Use `<Navigate>` to redirect `/` → `/swipe` if dateFrom is already set.

---

## Pages

### SetupPage (`/`)

**Purpose:** pick weekend dates + canton filter, then navigate to swipe deck.

**Layout (mobile):**
```
[Header: "Plan your weekend" + subtitle canton list]
[Date row: From | To]  ← two date inputs side by side
[Section label: "Cantons"]
[Canton pills row: GE VD FR VS JU — all on by default, toggleable]
[CTA button: "Start swiping →"]
```

**Behaviour:**
- Default dates: next Saturday → Sunday (computed with date-fns).
- At least 1 canton must remain active (prevent deselecting all).
- On "Start swiping": fetch `/activities?cantons=...` + `/events?date_from=...&date_to=...&cantons=...`, merge into deck (events first, then activities sorted by pref score), navigate to `/swipe`.
- Show loading spinner during fetch.

---

### SwipePage (`/swipe`)

**Purpose:** Tinder-style swipe through the deck.

**Layout (mobile):**
```
[Top bar: title "Discover" | dates | "Basket (N)" button]
[Progress bar: 0–100% based on deckIndex/deck.length]
[Card stack: top card + 2 ghost cards behind]
[Action buttons: ✕ Pass | ↑ Basket | ♥ Favourite]
[Hint labels: Pass | Basket | Favourite]
```

**Card anatomy:**
```
[Photo: full width, 200px tall, object-cover, lazy loaded]
  [Badge: "This weekend" (amber) | "Evergreen" (green)]
[Card body:]
  [Title: 17px semibold]
  [Meta row: 📍 Canton | ⏱ Duration | 🏷 Tag]
  [Description: 2 lines, truncated]
  [Link row: [🗺 Maps] [↗ Website] — tappable, open in new tab]
```

**Swipe gestures (use-gesture + react-spring):**
- Drag horizontally → rotate card up to ±15deg
- Drag up → show blue "↑ In basket" overlay
- Drag right >80px → green "♥ Favourite" overlay → vote('yes')
- Drag left >80px → red "✕ Pass" overlay → vote('no')
- Drag up >60px → blue "↑ In basket" overlay → vote('up')
- Button taps call same vote() function
- Card animates off screen on confirm (flyOut left/right/up)
- Next card springs up from stack

**On vote:**
1. Update `deckIndex` in store.
2. POST `/prefs` with `{activity_id, direction, session_id}`.
3. If `direction === 'up'`: add to `currentBasket` in store. Auto-save basket to DB (debounced 2s).
4. If `direction === 'yes'`: add to `currentBasket` AND mark as favourite locally.

**End of deck:**
- Show done screen: "All done! N activities in your basket."
- Button: "See your basket →" → navigate to `/basket`.
- Also show: "Swipe more" button → re-fetches deck with offset (if more available).

**Basket shortcut:** tapping "Basket (N)" in top bar navigates to `/basket` mid-swipe. Returning to `/swipe` resumes at `deckIndex`.

---

### BasketPage (`/basket`)

**Purpose:** view current basket, favourites, and history.

**Layout:**
```
[Top bar: "Your basket" + "New weekend" button]
[Subtitle: date range]
[Tab bar: "This weekend" | "Favourites" | "History"]
[Panel content below]
```

**Tab: This weekend**

List of `currentBasket` activities:
```
[Thumbnail 44px] [Title + Canton · Duration] [🗺] [↗] [🗑]
```
- Maps and website icons open in new tab.
- Trash icon removes from basket (updates store + PATCH /baskets/:id).
- Bottom: "Archive & plan new weekend" button → POST basket to `/baskets`, clear store, navigate to `/`.

**Tab: Favourites**

All activities ever voted 'yes' (pulled from `/prefs` where score ≥ 2, hydrated with activity details).
Same row format as basket. "+ Add to basket" icon instead of trash.

**Tab: History**

List of archived baskets from `/baskets?session_id=...`:
```
[Date range]           [N activities]
[Activity 1 · Activity 2 · ...]
```
Tap a row → `/basket/:id` → full detail view of that archived basket (read-only, with maps/website links).

---

## Components

### `<SwipeCard>`

Props: `activity: Activity, style: SpringValues, bind: BindFunction`
Renders card HTML. Photo with fallback emoji. Maps + website links.

### `<CardStack>`

Manages the spring animations for 3 stacked cards.
Uses `useSprings(3, ...)` from react-spring.
Handles drag binding via `useDrag` from @use-gesture/react.

### `<CantonFilter>`

Props: `active: string[], onChange: (cantons: string[]) => void`
Renders 5 pill buttons. Always keeps at least 1 active.

### `<BasketItem>`

Props: `activity: Activity, onRemove?: () => void, onAdd?: () => void`
Used in basket panel and favourites panel.

### `<ProgressBar>`

Props: `value: number (0–1)`
Thin bar, animates width via CSS transition.

### `<BottomNav>` (optional for v1)

Fixed bottom navigation for mobile: Discover | Basket | History.
Show only after first swipe session started.

---

## API client

```typescript
// src/api.ts
const BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export async function fetchActivities(cantons: string[]): Promise<Activity[]>
export async function fetchEvents(from: string, to: string, cantons: string[]): Promise<Activity[]>
export async function postPref(activityId: string, direction: Direction): Promise<void>
export async function saveBasket(basket: BasketPayload): Promise<Basket>
export async function fetchBaskets(): Promise<Basket[]>
export async function deleteBasket(id: string): Promise<void>
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
      '/api': 'http://localhost:8000'
    }
  }
})
```

Proxy ensures no CORS issues in dev. In production, configure reverse proxy (nginx or platform-level).

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
