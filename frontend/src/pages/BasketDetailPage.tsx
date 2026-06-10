import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchBasket } from '../api'
import { CANTON_LABELS } from '../lib/types'
import type { Activity } from '../lib/types'

function ThumbnailOrEmoji({ src, alt }: { src?: string | null; alt: string }) {
  const [errored, setErrored] = useState(false)
  if (!src || errored) {
    return <span className="text-2xl">🎯</span>
  }
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => setErrored(true)}
    />
  )
}

export default function BasketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: basket, isLoading } = useQuery({
    queryKey: ['basket', id],
    queryFn: () => fetchBasket(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-muted text-sm animate-pulse">Loading basket...</span>
      </div>
    )
  }

  if (!basket) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center text-3xl mb-3">
          🔍
        </div>
        <p className="text-text font-medium">Basket not found</p>
        <button
          onClick={() => navigate('/basket')}
          className="mt-4 px-5 py-2.5 rounded-xl bg-text text-bg font-medium"
        >
          ← Back to basket
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 py-6">
      <button
        onClick={() => navigate('/basket')}
        className="flex items-center gap-1 text-sm text-muted hover:text-text transition-colors mb-4 w-fit"
      >
        ← Back
      </button>

      <h1 className="text-2xl font-semibold mb-1">Archived basket</h1>
      <p className="text-sm text-muted mb-6">
        {basket.date_from?.slice(0, 10)} → {basket.date_to?.slice(0, 10)} ·{' '}
        {basket.activities.length} activities
      </p>

      <div className="space-y-3 flex-1">
        {basket.activities.map((activity: Activity) => (
          <div
            key={activity.id}
            className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-border"
          >
            <div className="w-14 h-14 rounded-xl bg-bg flex items-center justify-center flex-shrink-0 overflow-hidden">
              <ThumbnailOrEmoji src={activity.photo_url} alt={activity.title} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{activity.title}</p>
              <p className="text-xs text-muted mt-0.5">
                {CANTON_LABELS[activity.canton]} · {activity.duration_hint || 'Flexible'}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {activity.type === 'event' && activity.source_url && (
                <a
                  href={activity.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-bg border border-border flex items-center justify-center text-sm hover:bg-border/30 transition-colors"
                  aria-label="Open event source"
                >
                  📅
                </a>
              )}
              {activity.maps_url && (
                <a
                  href={activity.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-bg border border-border flex items-center justify-center text-sm hover:bg-border/30 transition-colors"
                  aria-label="Open in Maps"
                >
                  🗺
                </a>
              )}
              {activity.type === 'evergreen' && activity.website && (
                <a
                  href={activity.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-bg border border-border flex items-center justify-center text-sm hover:bg-border/30 transition-colors"
                  aria-label="Open website"
                >
                  ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
