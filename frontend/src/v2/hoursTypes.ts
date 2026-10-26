/** Hours rules and device activity shapes (backend/app/api/{hours,devices}.py). */

export type RuleCategory = 'school_night' | 'weekend' | 'holiday' | 'summer' | 'other'
export type RuleKind = 'allowed' | 'free' | 'off'

/** GET /hours rule. days: digits 0 (Mon)..6 (Sun); times "HH:MM". */
export interface HourRule {
  id: number
  name: string
  category: RuleCategory
  kind: RuleKind
  days: string
  start_date: string | null
  end_date: string | null
  everyone: boolean
  kid_ids: number[]
  group_ids: number[]
  times: { start: string; end: string }[]
}

export type RuleBody = Omit<HourRule, 'id'>

/** GET /hours */
export interface HoursPayload {
  today: RuleCategory | null
  rules: HourRule[]
}

export type EventKind =
  | 'bypass'
  | 'new_address'
  | 'outside_hours'
  | 'locked_try'
  | 'left_wifi'
  | 'sign_in'
  | 'address_change'
  | 'locked'
  | 'unlocked'

/** Event in GET /devices/{id}/activity (EventOut). */
export interface DeviceEvent {
  id: number
  kind: EventKind
  at: string
  last_at: string | null
  count: number
  reason: string | null
  kid_id: number | null
  kid_name: string | null
  by_name: string | null
  other_device_id: number | null
  other_device_name: string | null
  minutes: number | null
  detail: string | null
  reviewed: boolean
}

/** GET /devices/{id}/activity. slots: 144 chars, o online / l locked / . absent. */
export interface DeviceActivity {
  counts: { bypass: number; locked_tries: number; outside_hours: number; wrong_pins: number }
  events: DeviceEvent[]
  history: DeviceEvent[]
  days: { date: string; slots: string; online_minutes: number }[]
}
