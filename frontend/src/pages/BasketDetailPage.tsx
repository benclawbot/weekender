import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchBasket } from '../api'
import { CANTON_LABELS } from '../lib/types'
import type { Activity } from '../lib/types'

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
        <span className="text-muted">Loading...</span>
      </div>
    )
  }

  if (!basket) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-muted">Basket not found.</p>
        <button onClick={() => navigate('/basket')} className="mt-4 text-blue">
          ← Back to basket
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 py-6">
      <button
        onClick={() => navigate('/basket')}
        className="flex items-center gap-1 text-sm text-muted mb-4"
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
            <div className="w-11 h-11 rounded-xl bg-bg flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
              {activity.photo_url ? (
                <img
                  src={activity.photo_url}
                  alt={activity.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>🎯</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{activity.title}</p>
              <p className="text-xs text-muted">
                {CANTON_LABELS[activity.canton]}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {activity.type === 'event' && activity.source_url && (
                <a
                  href={activity.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-bg border border-border flex items-center justify-center text-sm"
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
                  className="w-9 h-9 rounded-full bg-bg border border-border flex items-center justify-center text-sm"
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
                  className="w-9 h-9 rounded-full bg-bg border border-border flex items-center justify-center text-sm"
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