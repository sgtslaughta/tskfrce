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
}

/** Chore entry inside /today and /kid/today */
export interface TodayChore {
  id: number
  title: string
  points: number
  state: ChoreState
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
  chores: TodayChore[]
  devices: TodayDevice[]
}

/** GET /today */
export interface Today {
  day: string
  pending_approvals: number
  new_devices: Device[]
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
}

/** GET /kid/whoami */
export interface KidWhoami {
  device: { id: number; name: string } | null
  kids: { id: number; full_name: string | null; avatar: string | null; has_pin: boolean }[]
}

/** GET /kid/today */
export interface KidToday {
  locked: boolean
  chores: TodayChore[]
  points_balance: number
}
