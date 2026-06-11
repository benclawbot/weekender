import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, nextSaturday, nextSunday } from 'date-fns'
import { useStore, type DeckMode } from '../store'
import { fetchActivities, fetchEvents } from '../api'
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
    mixEventsIntoDeck,
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
      const activities = await fetchActivities(cantons)
      const evergreen = activities.sort((a, b) => (b.pref_score ?? 0) - (a.pref_score ?? 0))
      if (evergreen.length === 0) {
        throw new Error('No evergreen activities are available for the selected cantons.')
      }

      setDates(from, to)
      setDeck(evergreen)
      navigate('/swipe')

      if (deckMode !== 'evergreen') {
        cantons.forEach((canton) => {
          void fetchEvents(from, to, [canton])
            .then(mixEventsIntoDeck)
            .catch((err) => console.warn(`Failed to load events for ${canton}:`, err))
        })
      }
    } catch (err) {
      console.error('Failed to load activities:', err)
      alert('The evergreen activities could not be loaded. Please check that the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col px-5 py-8 max-w-md mx-auto w-full">
      <div className="mb-7">
        <span className="funky-kicker mb-5">Your tiny escape machine</span>
        <h1 className="funky-title text-5xl text-text">Plan your<br /><span className="text-blue">weekend</span></h1>
        <p className="text-muted mt-4 text-sm font-bold">
          Pick your dates, choose your cantons, and we'll curate a deck just for you.
        </p>
      </div>

      <div className="funky-card space-y-6 rounded-[2rem] bg-white p-5">
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
          className="funky-button w-full py-4 rounded-2xl bg-green text-text font-black text-base uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
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
