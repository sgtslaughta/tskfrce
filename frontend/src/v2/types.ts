/** Shapes of the v2 backend responses (backend/app/api/{family,kid,devices,kids,windows,chores,setup}.py). */

export type Role = 'parent' | 'kid'
export type ChoreState = 'done' | 'needs_you' | 'todo'
export type DeviceStatus = 'unassigned' | 'assigned' | 'guest'
export type OverrideAction = 'lock' | 'unlock'

/** GET /setup */
export interface SetupStatus {
  needed: boolean
}

export interface Override {
  action: OverrideAction
  expires_at: string | null
}

/** GET /devices item (device_out) */
export interface Device {
  id: number
  name: string
  mac: string
  vendor: string | null
  status: DeviceStatus
  owner_ids: number[]
  group_ids: number[]
  online: boolean
  override: Override | null
  last_seen: string | null
  resisting: boolean
}

/** GET /blocker: home box liveness */
export interface BlockerStatus {
  online: boolean
  last_seen: string | null
}

/** GET /groups item */
export interface Group {
  id: number
  name: string
  device_ids: number[]
}

/** GET /kids item */
export interface Kid {
  id: number
  full_name: string | null
  username: string
  avatar: string | null
  has_pin: boolean
}

/** GET /windows item. days: digits 0 (Mon)..6 (Sun); start/end "HH:MM". */
export interface TimeWindow {
  id: number
  kind: 'allowed' | 'free'
  days: string
  start: string
  end: string
  kid_id: number | null
  group_id: number | null
}

/** GET/PATCH /family */
export interface Family {
  name: string
  timezone: string
  reset_time: string
  new_devices_blocked: boolean
  points_unlock_early: boolean
  early_bonus_cap: number
  screen_time_price: number
  gifs_enabled: boolean
  gif_rating: 'g' | 'pg'
  giphy_key_set: boolean
}

/** Chore entry inside /today and /kid/today */
export interface TodayChore {
  id: number
  title: string
  points: number
  state: ChoreState
  due_time?: string | null
  mode?: 'each' | 'race' | 'team'
  subtasks_done?: number
  subtasks_total?: number
  attempt?: number
  last_note?: string | null
  taken_by?: string | null
}

export interface TodayDevice {
  id: number
  name: string
  vendor: string | null
  online: boolean
}

export interface TodayKid {
  id: number
  name: string | null
  avatar: string | null
  online_all: boolean
  done?: number
  total?: number
  needs_you_count?: number
  last_active?: string | null
  progress?: Progress
  chores: TodayChore[]
  devices: TodayDevice[]
}

/** Item in GET /today needs_you. */
export interface NeedsItem {
  type: 'chore' | 'redo' | 'screen_time' | 'reward'
  id: number
  kid_id: number | null
  kid_name: string | null
  title: string
  attempt?: number
  thumb_url?: string | null
  subtasks_done?: number
  subtasks_total?: number
  submitted_at?: string | null
  cost?: number
  kid_balance?: number
  mode?: string
}

/** GET /today */
export interface Today {
  day: string
  pending_approvals: number
  new_devices: Device[]
  needs_you?: NeedsItem[]
  kids: TodayKid[]
}

/** POST /chores/ instance/definition, POST /chores/{id}/approve, GET /chores/today values */
export interface Chore {
  id: number
  title: string
  kid_id: number | null
  points: number
  status: string
  due_date: string | null
  needs_photo: boolean
  due_time?: string | null
}

/** GET /kid/whoami */
export interface KidWhoami {
  device: { id: number; name: string } | null
  kids: { id: number; full_name: string | null; avatar: string | null; has_pin: boolean }[]
}

/** GET /kid/today */
export interface KidChore extends TodayChore {
  mode?: 'each' | 'race' | 'team'
  needs_photo?: boolean
  photo_count_current?: number
  last_note?: string | null
  subtasks?: { id: number; title: string; done: boolean }[]
  taken_by?: string | null
}

export interface KidToday {
  locked: boolean
  chores: KidChore[]
  points_balance: number
  progress?: Progress
}

/** GET /kid/rewards */
export interface KidRewards {
  balance: number
  screen_time_price: number
  screen_time_enabled: boolean
  rewards: { id: number; name: string; price: number; icon: string | null }[]
  pending: { id: number; kind: 'reward' | 'screen_time'; reward_id: number | null; minutes: number | null; cost: number }[]
}

/** GET /kid/celebrations item. key: "r:<id>" | "b:<id>" | "l:<level>". */
export interface KidCelebration {
  key: string
  kind: 'reward' | 'screen_time' | 'badge' | 'level'
  title: string
  detail: string
  size: 'big' | 'small'
  /** level celebrations: flair newly unlocked */
  unlocked?: { id: string; label: string; emblem: string | null }[]
}

/** GET /custom-badges item. */
export interface CustomBadge {
  id: number
  name: string
  icon: string
  description: string
}

/** GET /rewards item */
export interface Reward {
  id: number
  name: string
  price: number
  icon: string | null
}

/** GET /redemptions item (pending requests) */
export interface PendingRedemption {
  id: number
  kid_id: number
  kid_name: string | null
  kind: 'screen_time' | 'reward'
  name: string
  minutes: number | null
  cost: number
  created_at: string
  kid_balance: number
}

/** progress block in GET /today kids and GET /kid/today */
export interface Progress {
  level: number
  title: string
  xp: number
  floor: number
  next: number
  streak: number
  flair?: Flair
}

export interface Badge {
  key: string
  name: string
  icon: string
  description: string
  tier: number
  tier_name: string
  custom: boolean
}

export interface LeaderboardRow {
  kid_id: number
  name: string
  avatar: string | null
  score: number
  level: number
  title: string
  rank: number
  flair?: Flair
}

/** GET /leaderboard */
export interface Leaderboard {
  week_start: string
  rows: LeaderboardRow[]
}

/** GET /profiles(/id) */
export interface Profile {
  kid_id: number
  name: string
  avatar: string | null
  level: number
  title: string
  streak: number
  badges: Badge[]
  flair?: Flair
}

export type FlairSlot = 'card' | 'ring' | 'name' | 'emblem' | 'title'

/** Equipped flair ids by slot (null = default look). */
export type Flair = Record<FlairSlot, string | null>

/** GET /kid/flair item */
export interface FlairItem {
  id: string
  slot: FlairSlot
  name: string
  unlock_level: number
  emblem: string | null
  unlocked: boolean
}

/** GET /kid/flair */
export interface FlairCatalog {
  level: number
  items: FlairItem[]
  equipped: Flair
}
