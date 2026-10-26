/** Plan E types: history, screen time, badge feed. Re-exported from types.ts. */

/** GET /redemptions/history row */
export interface HistoryRow {
  id: number
  kid_id: number
  kid_name: string | null
  kind: 'reward' | 'screen_time'
  name: string
  minutes: number | null
  cost: number
  status: 'approved' | 'denied'
  auto: boolean
  decided_by_name: string | null
  note: string | null
  created_at: string
  decided_at: string | null
}

/** GET /redemptions/history */
export interface History {
  totals: { spent: number; screen_minutes: number; approved: number; declined: number }
  rows: HistoryRow[]
}

export interface ScreenKid {
  kid_id: number
  name: string | null
  balance: number
  bought_today: number
  /** effective daily max (family and kid combined); null = no limit */
  max_minutes: number | null
  limit: { max_minutes: number | null; min_points: number | null } | null
}

/** GET/PATCH /screen-time */
export interface ScreenTime {
  enabled: boolean
  price: number
  max_minutes_per_day: number | null
  auto_approve: boolean
  only_in_allowed_hours: boolean
  reset_time: string
  avg_chore_points: number
  kids: ScreenKid[]
}

/** `screen` block of GET /kid/rewards */
export interface KidScreen {
  enabled: boolean
  price: number
  auto: boolean
  only_in_hours: boolean
  max_today: number | null
  bought_today: number
  left_today: number | null
  min_points: number | null
  in_hours: boolean
}

/** GET /badges/overview item; tiers maps kid id to tier (1+) */
export interface BadgeOverview {
  key: string
  name: string
  description: string
  icon: string
  custom: boolean
  tiers: Record<string, number>
}

/** GET /badges/recent item */
export interface RecentAward {
  id: number
  kid_id: number
  kid_name: string | null
  key: string
  name: string
  icon: string
  custom: boolean
  tier: number
  tier_name: string
  note: string | null
  by_name: string | null
  earned_at: string
}
