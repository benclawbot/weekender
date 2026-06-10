import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, nextSaturday, nextSunday } from 'date-fns'
import { useStore, type DeckMode } from '../store'
import { fetchActivities, fetchEvents } from '../api'
import type { Activity } from '../lib/types'
import { ALL_CANTONS, CANTON_LABELS } from '../lib/types'

const DECK_MODES: { id: DeckMode; label: string; sub: string }[] = [
  { id: 'events', label: 'Events', sub: 'Weekend events in Vaud' },
  { id: 'evergreen', label: 'Evergreen', sub: 'Always-available activities' },
  { id: 'both', label: 'Both', sub: 'Mix events and activities' },
]

export default function SetupPage() {
  const navigate = useNavigate()
  const {
    dateFrom,
    dateTo,
    activeCantons,
    deckMode,
    setDates,
    toggleCanton,
    setDeckMode,
    setDeck,
  } = useStore()

  const [loading, setLoading] = useState(false)

  const defaultFrom = format(nextSaturday(new Date()), 'yyyy-MM-dd')
  const defaultTo = format(nextSunday(new Date()), 'yyyy-MM-dd')
  const from = dateFrom || defaultFrom
  const to = dateTo || defaultTo

  const cantons = activeCantons.length > 0 ? activeCantons : ALL_CANTONS

  const handleStart = async () => {
    setLoading(true)
    try {
      const wantEvents = deckMode === 'events' || deckMode === 'both'
      const wantEvergreen = deckMode === 'evergreen' || deckMode === 'both'

      const [activities, events] = await Promise.all([
        wantEvergreen ? fetchActivities(cantons) : Promise.resolve<Activity[]>([]),
        wantEvents ? fetchEvents(from, to, cantons) : Promise.resolve<Activity[]>([]),
      ])

      // Truncate each pool to keep the deck a reasonable size; the per-canton
      // event scrape is capped at 20, and 20 evergreen per canton is plenty.
      const MAX_PER_POOL = 20
      const trimmedEvents = events.slice(0, MAX_PER_POOL)
      const trimmedEvergreen = activities.slice(0, MAX_PER_POOL)

      // Events first (so the user always sees time-bound stuff up top), then
      // evergreen sorted by pref_score DESC. Within each pool the source
      // order is preserved.
      const merged = [
        ...trimmedEvents,
        ...trimmedEvergreen.sort((a, b) => (b.pref_score ?? 0) - (a.pref_score ?? 0)),
      ]

      setDates(from, to)
      setDeck(merged)
      navigate('/swipe')
    } catch (err) {
      console.error('Failed to load activities:', err)
      alert('Failed to load activities. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col px-4 py-8 max-w-md mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-text">Plan your weekend</h1>
        <p className="text-muted mt-1 text-sm">
          Pick your dates, choose your cantons, and we'll curate a deck just for you.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-text mb-2">Dates</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-muted">From</span>
              <input
                type="date"
                value={from}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setDates(e.target.value, to)}
                className="w-full mt-1 px-3 py-2.5 rounded-xl bg-surface border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue/40"
              />
            </div>
            <div>
              <span className="text-xs text-muted">To</span>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setDates(from, e.target.value)}
                className="w-full mt-1 px-3 py-2.5 rounded-xl bg-surface border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue/40"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-2">Cantons</label>
          <div className="flex flex-wrap gap-2">
            {ALL_CANTONS.map((canton) => {
              const active = activeCantons.includes(canton)
              return (
                <button
                  key={canton}
                  onClick={() => toggleCanton(canton)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    active
                      ? 'bg-text text-bg'
                      : 'bg-surface border border-border text-muted hover:border-text/30'
                  }`}
                >
                  {CANTON_LABELS[canton]}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-2">Deck</label>
          <div className="grid grid-cols-3 gap-2">
            {DECK_MODES.map((m) => {
              const active = deckMode === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setDeckMode(m.id)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'bg-text text-bg'
                      : 'bg-surface border border-border text-muted hover:border-text/30'
                  }`}
                  title={m.sub}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted mt-1.5">
            {DECK_MODES.find((m) => m.id === deckMode)?.sub}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-8">
        <button
          onClick={handleStart}
          disabled={loading || activeCantons.length === 0}
          className="w-full py-4 rounded-2xl bg-text text-bg font-semibold text-base transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
        >
          {loading ? (
            <span className="animate-pulse">Loading...</span>
          ) : (
            <>
              Start swiping
              <span aria-hidden>→</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}