/** Shapes of the v2 backend responses (backend/app/api/{family,kid,devices,kids,windows,chores,setup}.py). */

export type ChoreState = 'done' | 'needs_you' | 'todo' | 'skipped'
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
  needs_pins?: boolean
  ip?: string | null
  ipv6?: string[]
  hostname?: string | null
  first_seen?: string | null
  resisting_since?: string | null
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
  icon?: string
  owner_ids?: number[]
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
export type AccentKey = 'neon' | 'sun' | 'tangerine' | 'bubblegum' | 'lilac' | 'sky' | 'aqua' | 'mint' | 'peach' | 'ice'

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
  accent?: AccentKey
  giphy_key_set: boolean
}

/** GET /chore-types item */
export interface ChoreType {
  id: number
  name: string
  glyph: string
  builtin: boolean
  notes: { id: number; label: string; glyph: string }[]
  chore_count: number
}

/** Quick-note preset a kid can send on a chore (/kid/today notes). */
export interface ChoreNote {
  label: string
  glyph: string
  universal: boolean
}

/** Step of a run (parent /family/today, /chores/{id}). */
export interface RunStep {
  id: number
  title: string
  done: boolean
  done_at?: string | null
  due_time: string | null
  due_at: string | null
  after_previous: boolean
  locked: boolean
}

/** Chore entry inside /today and /kid/today */
export interface TodayChore {
  id: number
  title: string
  points: number
  state: ChoreState
  due_time?: string | null
  done_at?: string | null
  mode?: 'each' | 'race' | 'team'
  subtasks_done?: number
  subtasks_total?: number
  attempt?: number
  last_note?: string | null
  taken_by?: string | null
  /** UTC ISO with Z; null = no deadline */
  due_at?: string | null
  type?: { id: number; name: string; glyph: string }
  sent_back?: boolean
  /** kid's flag on the run (parent view) */
  note?: { label: string; text: string | null; at: string; kid_name: string | null } | null
  /** points taken off, total */
  deducted?: number
  can_move?: boolean
}

/** GET /api/v1/chores/{run_id} - run detail with steps and photos */
export interface RunDetail {
  id: number
  title: string
  points: number
  state: ChoreState
  due_time: string | null
  kid_ids: number[]
  steps: RunStep[]
  due_at: string | null
  type: { id: number; name: string; glyph: string }
  sent_back: boolean
  note: { label: string; text: string | null; at: string; kid_name: string | null } | null
  can_move: boolean
  photos: Array<{ id: number; thumb_url: string }>
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
  /** points balance */
  points?: number
  /** points still needed for the cheapest reward not yet affordable; null = none */
  next_reward?: number | null
  /** UTC ISO end of today's allowed hours; null = no hours set or already outside them */
  locks_at?: string | null
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

/** Device with kids missing PINs */
export interface SharedDeviceNudge {
  device_id: number
  device_name: string
  kid_ids: number[]
  kid_names: string[]
}

/** GET /today */
export interface Today {
  day: string
  pending_approvals: number
  new_devices: Device[]
  needs_you?: NeedsItem[]
  shared_without_pin?: SharedDeviceNudge[]
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

/** One way a library chore is given out: POST /chores/{id}/assignments */
export interface Assignment {
  id: number
  chore_id: number
  kid_ids: number[]
  mode: 'each' | 'race' | 'team'
  repeat: { type: 'daily' | 'weekly' | 'once'; days: number[] }
  on_date: string | null
  due_time: string | null
  active: boolean
}

/** GET /chores: a chore in the library with its assignments */
export interface LibChore {
  id: number
  title: string
  points: number
  needs_photo: boolean
  type_id: number
  steps: { id: number; title: string; due_time: string | null; after_previous: boolean }[]
  assignments: Assignment[]
  archived: boolean
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
  notes?: ChoreNote[]
  deductions?: { amount: number; note: string | null; by_name: string | null; at: string }[]
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
