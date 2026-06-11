import type { Activity, Basket, Canton, Direction } from './lib/types'
import { getSessionId } from './lib/utils'

const BASE = import.meta.env.VITE_API_URL || '/api/v1'
const sessionId = getSessionId()

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export async function fetchActivities(cantons: Canton[]): Promise<Activity[]> {
  return apiFetch(`/activities?cantons=${cantons.join(',')}&session_id=${sessionId}`)
}

export async function fetchEvents(
  dateFrom: string,
  dateTo: string,
  cantons: Canton[],
): Promise<Activity[]> {
  return apiFetch(
    `/events?date_from=${dateFrom}&date_to=${dateTo}&cantons=${cantons.join(',')}`,
  )
}

export async function postPref(activityId: string, direction: Direction): Promise<void> {
  await apiFetch('/prefs', {
    method: 'POST',
    body: JSON.stringify({ activity_id: activityId, direction, session_id: sessionId }),
  })
}

export async function saveBasket(
  dateFrom: string,
  dateTo: string,
  activityIds: string[],
): Promise<Basket> {
  return apiFetch('/baskets', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      date_from: dateFrom,
      date_to: dateTo,
      activity_ids: activityIds,
    }),
  })
}

export async function fetchBaskets(): Promise<Basket[]> {
  return apiFetch(`/baskets?session_id=${sessionId}`)
}

export async function fetchBasket(id: string): Promise<Basket> {
  return apiFetch(`/baskets/${id}`)
}

export async function deleteBasket(id: string): Promise<void> {
  await apiFetch(`/baskets/${id}`, { method: 'DELETE' })
}

export async function removeActivityFromBasket(
  basketId: string,
  activityId: string,
): Promise<void> {
  await apiFetch(`/baskets/${basketId}/activities/${activityId}`, { method: 'PATCH' })
}

export async function fetchFavourites(): Promise<{ activity_id: string; score: number }[]> {
  return apiFetch(`/prefs?session_id=${sessionId}`)
}
