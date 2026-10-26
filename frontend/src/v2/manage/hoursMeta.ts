import type { Group, HourRule, Kid, RuleCategory, RuleKind } from '@/v2/types'

/** In precedence display order; `texture` is the .pt-* class. */
export const CATEGORIES: { key: RuleCategory; label: string; plural: string; texture: string }[] = [
  { key: 'school_night', label: 'School night', plural: 'School nights', texture: 'pt-school' },
  { key: 'weekend', label: 'Weekend', plural: 'Weekends', texture: 'pt-week' },
  { key: 'holiday', label: 'Holiday', plural: 'Holidays', texture: 'pt-holi' },
  { key: 'summer', label: 'Summer', plural: 'Summer', texture: 'pt-summer' },
  { key: 'other', label: 'Other', plural: 'Other hours', texture: 'pt-other' },
]

export const KINDS: { key: RuleKind; label: string; times: string }[] = [
  { key: 'allowed', label: 'Online', times: 'Times online' },
  { key: 'free', label: 'Free time', times: 'Free time' },
  { key: 'off', label: 'Internet off', times: 'Times off' },
]

const DAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** "Every day" / "Weekdays" / "Weekends" / "M W F" from a days string like "01234" (0 = Monday). */
export function daysLabel(days: string): string {
  const set = Array.from(new Set(days.split(''))).sort().join('')
  if (set === '0123456') return 'Every day'
  if (set === '01234') return 'Weekdays'
  if (set === '56') return 'Weekends'
  return set.split('').map((d) => DAY[Number(d)]).join(' ')
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Bar segments in % of the day; an overnight window (22:00-02:00) becomes two. */
export function segments(start: string, end: string): Array<[number, number]> {
  const s = (minutes(start) / 1440) * 100
  const e = (minutes(end) / 1440) * 100
  if (s === e) return [[0, 100]]
  return s < e ? [[s, e]] : [[s, 100], [0, e]]
}

function clock(hhmm: string): [string, string] {
  const [h, m] = hhmm.split(':').map(Number)
  return [`${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}`, h % 24 < 12 ? 'a' : 'p']
}

/** "6–8a", "8a–10p", "4–7:30p": the meridiem is shown once when both ends share it. */
export function rangeLabel(start: string, end: string): string {
  const [s, sm] = clock(start)
  const [e, em] = clock(end)
  return sm === em ? `${s}–${e}${em}` : `${s}${sm}–${e}${em}`
}

export const ruleTexture = (r: HourRule): string =>
  r.kid_ids.length ? 'pt-kid' : r.group_ids.length ? 'pt-group' : (CATEGORIES.find((c) => c.key === r.category)?.texture ?? 'pt-other')

export function whoLabel(r: HourRule, kids: Kid[], groups: Group[]): string {
  if (r.everyone) return 'Everyone'
  const names = [
    ...r.kid_ids.map((id) => kids.find((k) => k.id === id)?.full_name ?? 'A kid'),
    ...r.group_ids.map((id) => groups.find((g) => g.id === id)?.name ?? 'A group'),
  ]
  return names.length ? names.join(', ') : 'No one yet'
}

const target = (r: HourRule) => (r.kid_ids.length ? 2 : r.group_ids.length ? 1 : 0)
const catIndex = (r: HourRule) => CATEGORIES.findIndex((c) => c.key === r.category)

/** Timeline order: family rules first (category order), then group rules, then kid rules. */
export const sortRules = (rules: HourRule[]): HourRule[] =>
  [...rules].sort((a, b) => target(a) - target(b) || catIndex(a) - catIndex(b) || a.id - b.id)

/** Day buttons to pre-select for a category (null = leave as is). */
export const presetDays = (c: RuleCategory): string | null =>
  c === 'school_night' ? '01236' : c === 'weekend' ? '45' : c === 'other' ? null : '0123456'
