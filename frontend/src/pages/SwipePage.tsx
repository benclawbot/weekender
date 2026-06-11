import { useCallback, useRef, useState } from 'react'
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
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
        <div className="w-20 h-20 rounded-full bg-green/15 flex items-center justify-center text-4xl">
          🎉
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold">All done!</p>
          <p className="text-muted mt-2">
            {currentBasket.length === 0
              ? 'No activities in your basket yet.'
              : `${currentBasket.length} ${currentBasket.length === 1 ? 'activity' : 'activities'} in your basket`}
          </p>
        </div>
        <button
          onClick={() => navigate('/basket')}
          className="w-full max-w-xs px-6 py-3.5 rounded-2xl bg-text text-bg font-semibold transition-opacity hover:opacity-90"
        >
          See your basket →
        </button>
        <button
          onClick={() => navigate('/')}
          className="w-full max-w-xs px-6 py-3.5 rounded-2xl bg-surface border border-border text-text font-medium transition-colors hover:bg-border/30"
        >
          Plan a new weekend
        </button>
      </div>
    )
  }

  const progress = deck.length > 0 ? deckIndex / deck.length : 0

  return (
    <div className="flex-1 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-5">
        <div>
          <span className="funky-kicker">Fresh picks</span>
          <h1 className="funky-title mt-2 text-3xl">Discover</h1>
        </div>
        <button
          onClick={() => navigate('/basket')}
          className="funky-button relative px-4 py-2 rounded-full bg-amber text-sm font-black"
        >
          Basket
          {currentBasket.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-blue text-white text-xs flex items-center justify-center font-semibold">
              {currentBasket.length}
            </span>
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-3 border-2 border-text bg-white mx-5 rounded-full overflow-hidden">
        <div
          className="h-full bg-pink transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Card stack */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-4 py-4">
        <div className="relative w-full max-w-[380px] aspect-[3/4]">
          {remaining.slice(0, 3).map((activity, i) => {
            const spring = springs[i]
            if (!spring) return null
            const isTop = i === 0

            return (
              <animated.div
                key={activity.id}
                {...(isTop ? bind() : {})}
                className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
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
                {/* isTop kept in props for future hookups (e.g. disabling drag on ghosts) */}
              </animated.div>
            )
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-8 pb-10 pt-2">
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
  spring,
}: {
  activity: Activity
  isTop: boolean
  spring: ReturnType<typeof useSprings>[0][number]
}) {
  const x = spring.x
  const y = spring.y

  // Like (♥) overlay: fades in on right swipe
  const likeOpacity = x.to({
    range: [40, 100, 160],
    output: [0, 0.85, 0.95],
    extrapolate: 'clamp',
  })
  // Nope (✕) overlay: fades in on left swipe
  const nopeOpacity = x.to({
    range: [-160, -100, -40],
    output: [0.95, 0.85, 0],
    extrapolate: 'clamp',
  })
  // Save (↑) overlay: fades in on up swipe
  const upOpacity = y.to({
    range: [-160, -100, -40],
    output: [0.95, 0.85, 0],
    extrapolate: 'clamp',
  })

  return (
    <div className="funky-card bg-white rounded-[2rem] overflow-hidden h-full flex flex-col">
      {/* Photo — large, 16:10 aspect, fills top half of the card */}
      <div className="relative aspect-[16/10] bg-bg overflow-hidden flex-shrink-0">
        <PhotoOrEmoji
          src={activity.photo_url}
          alt={activity.title}
          emoji={getActivityEmoji(activity.tags)}
        />

        {/* Top gradient for badge legibility */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

        {/* Type badge */}
        <div className="absolute top-3 left-3">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${
              activity.type === 'event'
                ? 'bg-amber/90 text-white'
                : 'bg-green/90 text-white'
            }`}
          >
            {activity.type === 'event' ? 'This weekend' : 'Evergreen'}
          </span>
        </div>

        {/* Swipe feedback overlays */}
        <animated.div
          className="absolute inset-0 flex items-center justify-center bg-green-500/30 pointer-events-none"
          style={{ opacity: likeOpacity }}
        >
          <div className="px-4 py-2 rounded-xl border-4 border-green-700 text-green-700 text-2xl font-extrabold tracking-widest rotate-[-15deg] bg-white/80">
            FAVOURITE
          </div>
        </animated.div>
        <animated.div
          className="absolute inset-0 flex items-center justify-center bg-red-500/30 pointer-events-none"
          style={{ opacity: nopeOpacity }}
        >
          <div className="px-4 py-2 rounded-xl border-4 border-red-700 text-red-700 text-2xl font-extrabold tracking-widest rotate-[15deg] bg-white/80">
            PASS
          </div>
        </animated.div>
        <animated.div
          className="absolute inset-0 flex items-center justify-center bg-blue-500/30 pointer-events-none"
          style={{ opacity: upOpacity }}
        >
          <div className="px-4 py-2 rounded-xl border-4 border-blue-700 text-blue-700 text-2xl font-extrabold tracking-widest bg-white/80">
            IN BASKET
          </div>
        </animated.div>
      </div>

      {/* Card body */}
      <div className="p-4 flex-1 flex flex-col min-h-0">
        <h2 className="text-lg font-semibold leading-tight">{activity.title}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-muted">
          <span>📍 {CANTON_LABELS[activity.canton]}</span>
          {activity.duration_hint && <span>⏱ {activity.duration_hint}</span>}
          {activity.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-bg">
              {tag}
            </span>
          ))}
        </div>
        {activity.address && (
          <p className="text-sm text-muted mt-2 line-clamp-2">{activity.address}</p>
        )}

        {/* Primary link */}
        {(activity.type === 'event' && activity.source_url) ||
        (activity.type === 'evergreen' && activity.maps_url) ? (
          <a
            href={
              activity.type === 'event' && activity.source_url
                ? activity.source_url
                : activity.maps_url!
            }
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-text text-bg text-sm font-medium hover:opacity-90 transition-opacity"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {activity.type === 'event' ? 'View on myswitzerland.com' : 'Open in Maps'}
            <span aria-hidden>↗</span>
          </a>
        ) : null}

        {/* Secondary links */}
        {(activity.type === 'event' && activity.maps_url) || activity.website ? (
          <div className="flex gap-3 mt-3">
            {activity.type === 'event' && activity.maps_url && (
              <a
                href={activity.maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-blue hover:underline"
                onPointerDown={(e) => e.stopPropagation()}
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
                onPointerDown={(e) => e.stopPropagation()}
              >
                ↗ Website
              </a>
            )}
          </div>
        ) : null}
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
    red: 'bg-red/10 text-red border-red/30 hover:bg-red/20',
    blue: 'bg-blue/10 text-blue border-blue/30 hover:bg-blue/20',
    green: 'bg-green/10 text-green border-green/30 hover:bg-green/20',
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={onClick}
        className={`w-16 h-16 rounded-full border-2 flex items-center justify-center text-2xl transition-all active:scale-90 shadow-sm ${colors[color]}`}
        aria-label={label}
      >
        {symbol}
      </button>
      <span className="text-xs text-muted font-medium">{label}</span>
    </div>
  )
}

function PhotoOrEmoji({ src, alt, emoji }: { src?: string; alt: string; emoji: string }) {
  // Always render the img so a broken remote URL can fall back to the emoji
  // rather than leaving a broken image icon on the card.
  const [errored, setErrored] = useState(false)
  if (!src || errored) {
    return (
      <div className="w-full h-full flex items-center justify-center text-6xl bg-bg">
        {emoji}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      onError={() => setErrored(true)}
    />
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
