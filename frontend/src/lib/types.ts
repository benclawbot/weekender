export type Canton = 'GE' | 'VD' | 'FR' | 'VS' | 'JU'
export type Direction = 'yes' | 'up' | 'no'
export type ActivityType = 'evergreen' | 'event'

export interface OpeningHours {
  mon?: string; tue?: string; wed?: string
  thu?: string; fri?: string; sat?: string; sun?: string
}

export interface Activity {
  id: string
  title: string
  type: ActivityType
  canton: Canton
  address?: string
  lat?: number
  lng?: number
  opening_hours?: OpeningHours
  photo_url?: string
  maps_url?: string
  website?: string
  tags: string[]
  duration_hint?: string
  pref_score?: number
  date_from?: string
  date_to?: string
  source_url?: string
}

export interface Basket {
  id: string
  session_id: string
  date_from: string
  date_to: string
  activities: Activity[]
  created_at: string
}

export const CANTON_LABELS: Record<Canton, string> = {
  GE: 'Genève',
  VD: 'Vaud',
  FR: 'Fribourg',
  VS: 'Valais',
  JU: 'Jura',
}

export const ALL_CANTONS: Canton[] = ['GE', 'VD', 'FR', 'VS', 'JU']