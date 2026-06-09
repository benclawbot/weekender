import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, nextSaturday, nextSunday } from 'date-fns'
import { useStore } from '../store'
import { fetchActivities, fetchEvents } from '../api'
import type { Canton } from '../lib/types'
import { ALL_CANTONS, CANTON_LABELS } from '../lib/types'

export default function SetupPage() {
  const navigate = useNavigate()
  const { dateFrom, dateTo, activeCantons, setDates, toggleCanton, setDeck } = useStore()

  const [loading, setLoading] = useState(false)

  const defaultFrom = format(nextSaturday(new Date()), 'yyyy-MM-dd')
  const defaultTo = format(nextSunday(new Date()), 'yyyy-MM-dd')
  const from = dateFrom || defaultFrom
  const to = dateTo || defaultTo

  const cantons = activeCantons.length > 0 ? activeCantons : ALL_CANTONS

  const handleStart = async () => {
    setLoading(true)
    try {
      const [activities, events] = await Promise.all([
        fetchActivities(cantons),
        fetchEvents(from, to, cantons),
      ])

      // Events first, then activities sorted by pref_score
      const merged = [...events, ...activities].sort((a, b) => {
        const scoreA = a.pref_score ?? 0
        const scoreB = b.pref_score ?? 0
        return scoreB - scoreA
      })

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
          {cantons.map((c) => CANTON_LABELS[c as Canton]).join(' · ')}
        </p>
      </div>

      <div className="space-y-4">
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
                      : 'bg-surface border border-border text-muted'
                  }`}
                >
                  {CANTON_LABELS[canton]}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <button
          onClick={handleStart}
          disabled={loading || activeCantons.length === 0}
          className="w-full py-4 rounded-2xl bg-text text-bg font-semibold text-base transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
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