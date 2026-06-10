import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Activity, Canton } from './lib/types'

export type DeckMode = 'events' | 'evergreen' | 'both'

interface AppStore {
  // Setup
  dateFrom: string
  dateTo: string
  activeCantons: Canton[]
  deckMode: DeckMode

  // Swipe session
  deck: Activity[]
  deckIndex: number
  currentBasket: Activity[]

  // Actions
  setDates: (from: string, to: string) => void
  toggleCanton: (id: Canton) => void
  setDeckMode: (mode: DeckMode) => void
  setDeck: (items: Activity[]) => void
  swipe: (direction: 'yes' | 'up' | 'no') => void
  removeFromBasket: (id: string) => void
  addToBasket: (activity: Activity) => void
  resetSession: () => void
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      dateFrom: '',
      dateTo: '',
      activeCantons: ['GE', 'VD', 'FR', 'VS', 'JU'],
      deckMode: 'events',
      deck: [],
      deckIndex: 0,
      currentBasket: [],

      setDates: (from, to) => set({ dateFrom: from, dateTo: to }),

      toggleCanton: (id) =>
        set((s) => {
          const active = s.activeCantons.includes(id)
            ? s.activeCantons.filter((c) => c !== id)
            : [...s.activeCantons, id]
          // Prevent deselecting all
          if (active.length === 0) return {}
          return { activeCantons: active }
        }),

      setDeckMode: (mode) => set({ deckMode: mode }),

      setDeck: (items) => set({ deck: items, deckIndex: 0 }),

      swipe: (direction) => {
        const { deckIndex, deck, currentBasket } = get()
        const activity = deck[deckIndex]
        if (!activity) return

        const basket =
          direction === 'up' || direction === 'yes'
            ? [...currentBasket.filter((a) => a.id !== activity.id), activity]
            : currentBasket

        set({ deckIndex: deckIndex + 1, currentBasket: basket })
      },

      removeFromBasket: (id) =>
        set((s) => ({ currentBasket: s.currentBasket.filter((a) => a.id !== id) })),

      addToBasket: (activity) =>
        set((s) => {
          if (s.currentBasket.some((a) => a.id === activity.id)) return {}
          return { currentBasket: [...s.currentBasket, activity] }
        }),

      resetSession: () =>
        set({ deck: [], deckIndex: 0, currentBasket: [] }),
    }),
    {
      name: 'weekend-store',
      partialize: (s) => ({
        dateFrom: s.dateFrom,
        dateTo: s.dateTo,
        activeCantons: s.activeCantons,
        deckMode: s.deckMode,
        currentBasket: s.currentBasket,
      }),
    },
  ),
)