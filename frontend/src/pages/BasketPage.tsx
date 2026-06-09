import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStore } from '../store'
import { fetchBaskets, fetchFavourites, fetchActivities, saveBasket, deleteBasket, removeActivityFromBasket } from '../api'
import { CANTON_LABELS } from '../lib/types'
import type { Activity, Canton } from '../lib/types'

type Tab = 'current' | 'favourites' | 'history'

export default function BasketPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { dateFrom, dateTo, currentBasket, removeFromBasket, activeCantons, resetSession } = useStore()
  const [activeTab, setActiveTab] = useState<Tab>('current')

  const basketsQuery = useQuery({
    queryKey: ['baskets'],
    queryFn: fetchBaskets,
  })

  const favouritesQuery = useQuery({
    queryKey: ['favourites'],
    queryFn: fetchFavourites,
  })

  const saveBasketMutation = useMutation({
    mutationFn: () => saveBasket(dateFrom, dateTo, currentBasket.map((a) => a.id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baskets'] })
    },
  })

  const deleteBasketMutation = useMutation({
    mutationFn: deleteBasket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baskets'] })
    },
  })

  const handleArchive = async () => {
    await saveBasketMutation.mutateAsync()
    resetSession()
    navigate('/')
  }

  const handleNewWeekend = () => {
    resetSession()
    navigate('/')
  }

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">Your basket</h1>
        <button
          onClick={handleNewWeekend}
          className="px-3 py-1.5 rounded-full bg-surface border border-border text-sm"
        >
          New weekend
        </button>
      </div>
      <p className="text-sm text-muted mb-4">
        {dateFrom} → {dateTo}
      </p>

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        {(['current', 'favourites', 'history'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-text text-text'
                : 'border-transparent text-muted'
            }`}
          >
            {tab === 'current' ? 'This weekend' : tab === 'favourites' ? 'Favourites' : 'History'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'current' && (
        <CurrentBasket
          activities={currentBasket}
          onRemove={removeFromBasket}
          onArchive={handleArchive}
          archiving={saveBasketMutation.isPending}
        />
      )}
      {activeTab === 'favourites' && (
        <FavouritesTab
          favourites={favouritesQuery.data ?? []}
          isLoading={favouritesQuery.isLoading}
          onRefresh={() => favouritesQuery.refetch()}
        />
      )}
      {activeTab === 'history' && (
        <HistoryTab
          baskets={basketsQuery.data ?? []}
          isLoading={basketsQuery.isLoading}
          onDelete={(id) => deleteBasketMutation.mutate(id)}
        />
      )}
    </div>
  )
}

function CurrentBasket({
  activities,
  onRemove,
  onArchive,
  archiving,
}: {
  activities: Activity[]
  onRemove: (id: string) => void
  onArchive: () => void
  archiving: boolean
}) {
  if (activities.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <p className="text-muted">No activities yet.</p>
        <p className="text-sm text-muted mt-1">Go swipe some!</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 space-y-3">
        {activities.map((activity) => (
          <BasketItem
            key={activity.id}
            activity={activity}
            onRemove={onRemove}
          />
        ))}
      </div>
      <button
        onClick={onArchive}
        disabled={archiving}
        className="mt-4 w-full py-3.5 rounded-2xl bg-text text-bg font-semibold disabled:opacity-50"
      >
        {archiving ? 'Saving...' : 'Archive & plan new weekend'}
      </button>
    </div>
  )
}

function FavouritesTab({
  favourites,
  isLoading,
  onRefresh,
}: {
  favourites: { activity_id: string; score: number }[]
  isLoading: boolean
  onRefresh: () => void
}) {
  const { activeCantons, addToBasket } = useStore()
  const [favActivities, setFavActivities] = useState<Activity[]>([])

  const favIds = favourites.filter((f) => f.score >= 2).map((f) => f.activity_id)

  const queryClient = useQueryClient()

  const fetchFavActivities = async () => {
    try {
      const activities = await fetchActivities(activeCantons as Canton[])
      return activities.filter((a) => favIds.includes(a.id))
    } catch {
      return []
    }
  }

  if (isLoading) return <div className="text-center text-muted py-8">Loading...</div>

  return (
    <div className="flex-1 space-y-3">
      {favIds.length === 0 ? (
        <p className="text-muted text-center py-8">No favourites yet. Swipe right on activities you love!</p>
      ) : (
        favIds.map((id) => (
          <div key={id} className="text-sm text-muted py-2">Loading activity {id}...</div>
        ))
      )}
    </div>
  )
}

function HistoryTab({
  baskets,
  isLoading,
  onDelete,
}: {
  baskets: any[]
  isLoading: boolean
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()

  if (isLoading) return <div className="text-center text-muted py-8">Loading...</div>

  if (baskets.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <p className="text-muted">No archived baskets yet.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-3">
      {baskets.map((basket) => (
        <button
          key={basket.id}
          onClick={() => navigate(`/basket/${basket.id}`)}
          className="w-full text-left p-4 rounded-2xl bg-surface border border-border"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-sm">
                {basket.date_from?.slice(0, 10)} → {basket.date_to?.slice(0, 10)}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {basket.activities?.length ?? 0} activities
              </p>
              <p className="text-xs text-muted mt-1 truncate">
                {basket.activities?.slice(0, 3).map((a: Activity) => a.title).join(' · ')}
                {(basket.activities?.length ?? 0) > 3 ? '...' : ''}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(basket.id)
              }}
              className="text-red/60 hover:text-red text-xs px-2 py-1"
            >
              Delete
            </button>
          </div>
        </button>
      ))}
    </div>
  )
}

function BasketItem({
  activity,
  onRemove,
}: {
  activity: Activity
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-border">
      <div className="w-11 h-11 rounded-xl bg-bg flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
        {activity.photo_url ? (
          <img src={activity.photo_url} alt={activity.title} className="w-full h-full object-cover" />
        ) : (
          <span>🎯</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{activity.title}</p>
        <p className="text-xs text-muted">
          {CANTON_LABELS[activity.canton]} · {activity.duration_hint || 'Flexible'}
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
        <button
          onClick={() => onRemove(activity.id)}
          className="w-9 h-9 rounded-full bg-red/10 text-red flex items-center justify-center text-sm"
          aria-label="Remove from basket"
        >
          🗑
        </button>
      </div>
    </div>
  )
}