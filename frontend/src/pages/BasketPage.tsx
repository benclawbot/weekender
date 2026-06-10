import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStore } from '../store'
import {
  fetchBaskets,
  fetchFavourites,
  fetchActivities,
  saveBasket,
  deleteBasket,
} from '../api'
import { CANTON_LABELS } from '../lib/types'
import type { Activity, Basket, Canton } from '../lib/types'

type Tab = 'current' | 'favourites' | 'history'

export default function BasketPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { dateFrom, dateTo, currentBasket, removeFromBasket, resetSession } = useStore()
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

  const currentCount = currentBasket.length
  const favCount = favouritesQuery.data?.filter((f) => f.score >= 2).length ?? 0
  const historyCount = basketsQuery.data?.length ?? 0

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">Your basket</h1>
        <button
          onClick={handleNewWeekend}
          className="px-3 py-1.5 rounded-full bg-surface border border-border text-sm hover:bg-border/40 transition-colors"
        >
          New weekend
        </button>
      </div>
      <p className="text-sm text-muted mb-4">
        {dateFrom} → {dateTo}
      </p>

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        {([
          { id: 'current', label: 'This weekend', count: currentCount },
          { id: 'favourites', label: 'Favourites', count: favCount },
          { id: 'history', label: 'History', count: historyCount },
        ] as { id: Tab; label: string; count: number }[]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === tab.id
                ? 'border-text text-text'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="text-xs bg-surface px-1.5 py-0.5 rounded-full">{tab.count}</span>
            )}
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
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center text-3xl mb-3">
          🧺
        </div>
        <p className="text-text font-medium">No activities yet</p>
        <p className="text-sm text-muted mt-1">
          Swipe up to add things to your weekend basket.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 space-y-3">
        {activities.map((activity) => (
          <BasketItem key={activity.id} activity={activity} onRemove={onRemove} />
        ))}
      </div>
      <button
        onClick={onArchive}
        disabled={archiving}
        className="mt-4 w-full py-3.5 rounded-2xl bg-text text-bg font-semibold disabled:opacity-50 transition-opacity"
      >
        {archiving ? 'Saving...' : 'Archive & plan new weekend'}
      </button>
    </div>
  )
}

function FavouritesTab({
  favourites,
  isLoading,
}: {
  favourites: { activity_id: string; score: number }[]
  isLoading: boolean
}) {
  const { activeCantons, addToBasket } = useStore()

  const favIds = favourites.filter((f) => f.score >= 2).map((f) => f.activity_id)
  const favSet = new Set(favIds)

  const activitiesQuery = useQuery({
    queryKey: ['activities-for-favs', activeCantons],
    queryFn: () => fetchActivities(activeCantons as Canton[]),
    enabled: favIds.length > 0,
  })

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-8">
        <span className="text-muted text-sm animate-pulse">Loading favourites...</span>
      </div>
    )
  }

  if (favIds.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center text-3xl mb-3">
          ♥
        </div>
        <p className="text-text font-medium">No favourites yet</p>
        <p className="text-sm text-muted mt-1">
          Swipe right on activities you love to save them here.
        </p>
      </div>
    )
  }

  if (activitiesQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-8">
        <span className="text-muted text-sm animate-pulse">Loading favourites...</span>
      </div>
    )
  }

  const matched: Activity[] = (activitiesQuery.data ?? []).filter((a) => favSet.has(a.id))

  if (matched.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <p className="text-muted text-sm">
          Couldn't find favourite activities in the current canton selection.
        </p>
        <p className="text-xs text-muted mt-1">Try enabling more cantons.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-3">
      {matched.map((activity) => (
        <FavouriteItem
          key={activity.id}
          activity={activity}
          onAdd={() => addToBasket(activity)}
        />
      ))}
    </div>
  )
}

function FavouriteItem({
  activity,
  onAdd,
}: {
  activity: Activity
  onAdd: () => void
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-border">
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
        <button
          onClick={onAdd}
          className="w-9 h-9 rounded-full bg-blue/10 text-blue flex items-center justify-center text-sm hover:bg-blue/20 transition-colors"
          aria-label="Add to basket"
        >
          ↑
        </button>
      </div>
    </div>
  )
}

function HistoryTab({
  baskets,
  isLoading,
  onDelete,
}: {
  baskets: Basket[]
  isLoading: boolean
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-8">
        <span className="text-muted text-sm animate-pulse">Loading history...</span>
      </div>
    )
  }

  if (baskets.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center text-3xl mb-3">
          📚
        </div>
        <p className="text-text font-medium">No archived baskets yet</p>
        <p className="text-sm text-muted mt-1">
          Archive a basket from "This weekend" to see it here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-3">
      {baskets.map((basket) => (
        <div
          key={basket.id}
          className="w-full text-left p-4 rounded-2xl bg-surface border border-border hover:border-text/20 transition-colors"
        >
          <div className="flex justify-between items-start">
            <button
              onClick={() => navigate(`/basket/${basket.id}`)}
              className="flex-1 text-left min-w-0"
            >
              <p className="font-medium text-sm">
                {basket.date_from?.slice(0, 10)} → {basket.date_to?.slice(0, 10)}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {basket.activities?.length ?? 0} activities
              </p>
              {basket.activities && basket.activities.length > 0 && (
                <p className="text-xs text-muted mt-1 truncate">
                  {basket.activities.slice(0, 3).map((a) => a.title).join(' · ')}
                  {basket.activities.length > 3 ? '…' : ''}
                </p>
              )}
            </button>
            <button
              onClick={() => onDelete(basket.id)}
              className="text-red/60 hover:text-red text-xs px-2 py-1"
              aria-label="Delete basket"
            >
              Delete
            </button>
          </div>
        </div>
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
        <button
          onClick={() => onRemove(activity.id)}
          className="w-9 h-9 rounded-full bg-red/10 text-red flex items-center justify-center text-sm hover:bg-red/20 transition-colors"
          aria-label="Remove from basket"
        >
          🗑
        </button>
      </div>
    </div>
  )
}

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