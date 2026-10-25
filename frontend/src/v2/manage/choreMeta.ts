import type { Assignment, Kid, LibChore } from '@/v2/types'
import { DAYS } from '@/v2/days'

export const nameOf = (k: Kid) => k.full_name ?? k.username
export const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase()

/** Kid ids with an active assignment of this chore. */
export const usedBy = (c: LibChore) => Array.from(new Set(c.assignments.filter((a) => a.active).flatMap((a) => a.kid_ids)))

function repeatText(a: Assignment) {
  const { type } = a.repeat
  if (type === 'daily') return 'daily'
  if (type === 'once') return 'once'
  const days = [...a.repeat.days].sort()
  const key = days.join('')
  if (key === '01234') return 'weekdays'
  if (key === '56') return 'weekends'
  return days.map((d) => DAYS[d]).join(' ')
}

/** Distinct schedules of the active assignments, e.g. ["daily", "Sat"]. */
export const schedules = (c: LibChore) => Array.from(new Set(c.assignments.filter((a) => a.active).map(repeatText)))

/** "30 pts · daily · 3 steps · photo" */
export function choreLine(c: LibChore) {
  const bits = [`${c.points} pts`, ...schedules(c)]
  if (c.steps.length) bits.push(`${c.steps.length} ${c.steps.length === 1 ? 'step' : 'steps'}`)
  if (c.needs_photo) bits.push('photo')
  return bits.join(' · ')
}
