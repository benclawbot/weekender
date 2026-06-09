import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSprings, animated } from 'react-spring'
import { useDrag } from '@use-gesture/react'
import { useStore } from '../store'
import { postPref } from '../api'
import { CANTON_LABELS } from '../lib/types'
import type { Activity } from '../lib/types'

const SWIPE_THRESHOLD = 80
const CARD_WIDTH = 380

function getRelativeX(x: number, width: number) {
  return (x / width) * 15
}

export default function SwipePage() {
  const navigate = useNavigate()
  const { deck, deckIndex, currentBasket, swipe } = useStore()
  const remaining = deck.slice(deckIndex)
  const card = remaining[0]

  const voteRef = useRef<(direction: 'yes' | 'up' | 'no') => void>(() => {})

  const handleVote = useCallback(
    async (direction: 'yes' | 'up' | 'no') => {
      if (!card) return
      swipe(direction)
      try {
        await postPref(card.id, direction)
      } catch (e) {
        console.error('Failed to post pref', e)
      }
    },
    [card, swipe],
  )

  voteRef.current = handleVote

  const [springs, api] = useSprings(3, () => ({
    x: 0,
    y: 0,
    rot: 0,
    scale: 1,
    opacity: 1,
  }))

  const bind = useDrag(
    ({ args: [_], active, movement: [mx, my], direction: [dx, dy], velocity: [vx, vy] }) => {
      const x = active ? mx : 0
      const y = active ? my : 0
      const rot = getRelativeX(x, CARD_WIDTH)
      const scale = active ? 1.02 : 1

      api.start((i) => {
        if (i !== 0) return {}
        return { x, y, rot, scale, immediate: active }
      })

      if (!active) {
        if (mx > SWIPE_THRESHOLD || (dx > 0 && vx > 0.3)) {
          // Swipe right → favourite
          api.start((i) => {
            if (i !== 0) return {}
            return { x: CARD_WIDTH * 1.5, rot: 30, opacity: 0 }
          })
          setTimeout(() => voteRef.current('yes'), 100)
        } else if (my < -SWIPE_THRESHOLD || (dy < 0 && vy > 0.3)) {
          // Swipe up → basket
          api.start((i) => {
            if (i !== 0) return {}
            return { y: -window.innerHeight, opacity: 0 }
          })
          setTimeout(() => voteRef.current('up'), 100)
        } else if (mx < -SWIPE_THRESHOLD || (dx < 0 && vx > 0.3)) {
          // Swipe left → pass
          api.start((i) => {
            if (i !== 0) return {}
            return { x: -CARD_WIDTH * 1.5, rot: -30, opacity: 0 }
          })
          setTimeout(() => voteRef.current('no'), 100)
        } else {
          api.start({ x: 0, y: 0, rot: 0, scale: 1 })
        }
      }
    },
    {
      from: () => [springs[0].x.get(), springs[0].y.get()],
      filterTaps: true,
    },
  )

  if (!card) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-center">
          <p className="text-2xl font-semibold">All done!</p>
          <p className="text-muted mt-2">
            {currentBasket.length} activities in your basket
          </p>
        </div>
        <button
          onClick={() => navigate('/basket')}
          className="px-6 py-3 rounded-2xl bg-text text-bg font-semibold"
        >
          See your basket →
        </button>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 rounded-2xl bg-surface border border-border text-text"
        >
          Swipe more
        </button>
      </div>
    )
  }

  const progress = deck.length > 0 ? deckIndex / deck.length : 0

  return (
    <div className="flex-1 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-lg font-semibold">Discover</span>
        <button
          onClick={() => navigate('/basket')}
          className="relative px-3 py-2 rounded-full bg-surface text-sm font-medium"
        >
          Basket
          {currentBasket.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue text-white text-xs flex items-center justify-center">
              {currentBasket.length}
            </span>
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-surface mx-4 rounded-full overflow-hidden">
        <div
          className="h-full bg-text transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Card stack */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-4">
        <div className="relative w-full max-w-[380px]">
          {remaining.slice(0, 3).map((activity, i) => {
            const spring = springs[i]
            if (!spring) return null
            const isTop = i === 0

            return (
              <animated.div
                key={activity.id}
                {...(isTop ? bind() : {})}
                className="absolute inset-0 w-full cursor-grab active:cursor-grabbing"
                style={{
                  transform: spring.x
                    .to({
                      range: [-CARD_WIDTH * 1.5, 0, CARD_WIDTH * 1.5],
                      output: [-30, 0, 30],
                    })
                    .to((rot) => `translateX(${spring.x.get()}px) translateY(${spring.y.get()}px) rotate(${rot}deg) scale(${spring.scale.get()})`),
                  opacity: spring.opacity,
                  zIndex: 10 - i,
                }}
              >
                <SwipeCard activity={activity} isTop={isTop} spring={spring} />
              </animated.div>
            )
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-6 pb-10 pt-2">
        <ActionButton
          label="Pass"
          symbol="✕"
          color="red"
          onClick={() => handleVote('no')}
        />
        <ActionButton
          label="Basket"
          symbol="↑"
          color="blue"
          onClick={() => handleVote('up')}
        />
        <ActionButton
          label="Favourite"
          symbol="♥"
          color="green"
          onClick={() => handleVote('yes')}
        />
      </div>
    </div>
  )
}

function SwipeCard({
  activity,
  isTop,
  spring,
}: {
  activity: Activity
  isTop: boolean
  spring: ReturnType<typeof useSprings>[0][number]
}) {
  const x = spring.x
  const y = spring.y

  // Simple number interpolations only — avoids string interpolation arity bugs
  const overlayOpacity = x.to({
    range: [-160, -80, 0, 80, 160],
    output: [0, 0.8, 0, 0, 0],
    extrapolate: 'clamp',
  })

  const overlayColor = x.to({
    range: [-160, 0, 160],
    output: ['rgba(163,45,45,0.5)', 'rgba(0,0,0,0)', 'rgba(59,109,17,0.5)'],
    extrapolate: 'clamp',
  })

  const upOverlayOpacity = y.to({
    range: [-160, -80, 0],
    output: [0.5, 0.5, 0],
    extrapolate: 'clamp',
  })

  return (
    <div className="bg-surface rounded-3xl overflow-hidden shadow-sm border border-border">
      {/* Photo */}
      <div className="relative h-48 bg-surface overflow-hidden">
        {activity.photo_url ? (
          <img
            src={activity.photo_url}
            alt={activity.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">
            {getActivityEmoji(activity.tags)}
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activity.type === 'event'
                ? 'bg-amber/20 text-amber'
                : 'bg-green/20 text-green'
            }`}
          >
            {activity.type === 'event' ? 'This weekend' : 'Evergreen'}
          </span>
        </div>
        {/* Swipe overlays */}
        <animated.div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            backgroundColor: overlayColor,
            opacity: overlayOpacity,
          }}
        />
        <animated.div
          className="absolute inset-0 flex items-center justify-center bg-blue/30"
          style={{ opacity: upOverlayOpacity }}
        />
      </div>

      {/* Card body */}
      <div className="p-4">
        <h2 className="text-lg font-semibold leading-tight">{activity.title}</h2>
        <div className="flex items-center gap-3 mt-1.5 text-sm text-muted">
          <span>📍 {CANTON_LABELS[activity.canton]}</span>
          {activity.duration_hint && <span>⏱ {activity.duration_hint}</span>}
          {activity.tags[0] && <span>🏷 {activity.tags[0]}</span>}
        </div>
        <p className="text-sm text-muted mt-2 line-clamp-2">{activity.address || 'Address not available'}</p>

        {/* Primary link — type-aware. Drag is bound to the parent card, so the
            anchor only fires when the user actually taps it (clicks bubble up
            to the anchor; drags are captured by the gesture handler). */}
        {activity.type === 'event' && activity.source_url ? (
          <a
            href={activity.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-text text-bg text-sm font-medium"
          >
            Voir sur agenda.ch ↗
          </a>
        ) : activity.type === 'evergreen' && activity.maps_url ? (
          <a
            href={activity.maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-text text-bg text-sm font-medium"
          >
            Voir sur Maps ↗
          </a>
        ) : null}

        {/* Secondary links */}
        <div className="flex gap-3 mt-3">
          {activity.type === 'event' && activity.maps_url && (
            <a
              href={activity.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-blue hover:underline"
            >
              🗺 Maps
            </a>
          )}
          {activity.website && (
            <a
              href={activity.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-blue hover:underline"
            >
              ↗ Website
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionButton({
  label,
  symbol,
  color,
  onClick,
}: {
  label: string
  symbol: string
  color: 'red' | 'blue' | 'green'
  onClick: () => void
}) {
  const colors = {
    red: 'bg-red/10 text-red border-red/30',
    blue: 'bg-blue/10 text-blue border-blue/30',
    green: 'bg-green/10 text-green border-green/30',
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-xl transition-transform active:scale-90 ${colors[color]}`}
        aria-label={label}
      >
        {symbol}
      </button>
      <span className="text-xs text-muted">{label}</span>
    </div>
  )
}

function getActivityEmoji(tags: string[]): string {
  const tagEmojis: Record<string, string> = {
    outdoor: '🌲',
    nature: '🌿',
    museum: '🏛',
    family: '👨‍👩‍👧',
    indoor: '🏠',
    water: '🌊',
    hiking: '🥾',
    beach: '🏖',
    playground: '🛝',
    culture: '🎭',
    animals: '🦁',
    mountain: '⛰',
    castle: '🏰',
    art: '🎨',
    history: '📜',
  }
  for (const tag of tags) {
    if (tagEmojis[tag]) return tagEmojis[tag]
  }
  return '🎯'
}