import { clockText } from '../clockText'
import type { KidChore, KidStep } from '../types'

export type KidTone = 'back' | 'late' | 'soon' | 'new' | 'today' | 'later' | 'wait' | 'done'
export interface KidChipT {
  tone: KidTone
  icon: string
  label: string
}

const fmt = (iso: string, tz: string | undefined, short: boolean) => clockText(iso, tz, short)
/** "4:30 PM" */
export const clock = (iso: string, tz?: string) => fmt(iso, tz, false)
/** "4:30" */
export const clockShort = (iso: string, tz?: string) => fmt(iso, tz, true)

const HOUR = 3_600_000

/** Every chip that applies, in priority order (back, late, soon, new, today). */
export function kidChips(c: KidChore, now: number, tz?: string, little = false): KidChipT[] {
  if (c.state === 'skipped') return []
  if (c.state === 'needs_you') return [{ tone: 'wait', icon: 'hourglass_top', label: 'Waiting for OK' }]
  if (c.state === 'done') return [{ tone: 'done', icon: 'check', label: little ? 'Done' : 'Approved' }]
  const out: KidChipT[] = []
  const due = c.due_at ? Date.parse(c.due_at) : null
  if (c.sent_back) out.push({ tone: 'back', icon: 'undo', label: 'Sent back' })
  if (due !== null && due < now) out.push({ tone: 'late', icon: 'alarm', label: little ? 'Late!' : 'Overdue' })
  else if (due !== null && due - now <= HOUR) {
    const m = Math.max(1, Math.ceil((due - now) / 60_000))
    out.push({ tone: 'soon', icon: 'hourglass_bottom', label: little ? `Hurry · ${m} min` : `Due in ${m} min` })
  }
  if (c.new) out.push({ tone: 'new', icon: 'fiber_new', label: 'New' })
  if (due !== null && due - now > HOUR) {
    out.push({ tone: 'today', icon: 'schedule', label: `${little ? 'By' : 'Due'} ${clockShort(c.due_at!, tz)}` })
  }
  return out
}

export function stepChip(s: KidStep, now: number, tz?: string): { tone: 'late' | 'soon' | 'later'; time: string } | null {
  if (s.done || !s.due_at) return null
  const due = Date.parse(s.due_at)
  const tone = due < now ? 'late' : due - now <= HOUR ? 'soon' : 'later'
  return { tone, time: clockShort(s.due_at, tz) }
}

export const stepBadge = (steps: KidStep[], i: number): string =>
  steps[i].after_previous || steps[i + 1]?.after_previous ? String(i + 1) : '–'

export const nextStep = (steps: KidStep[]): number => steps.findIndex((s) => !s.done && !s.locked)

export function stepHint(steps: KidStep[], i: number, tz?: string): string {
  const s = steps[i]
  if (s.done) return s.done_at ? `Done at ${clock(s.done_at, tz)}` : 'Done'
  const parts: string[] = []
  if (s.locked) {
    let j = i - 1
    while (j >= 0 && steps[j].done) j--
    parts.push(j >= 0 ? `Unlocks after step ${j + 1}` : 'Locked')
  } else if (nextStep(steps) === i) parts.push('Do this next')
  else if (stepBadge(steps, i) === '–') parts.push('Any time')
  if (s.due_at) parts.push(`by ${clock(s.due_at, tz)}`)
  return parts.join(' · ')
}

/** Sorts for display; drops skipped chores. */
export function kidSort(chores: KidChore[], now: number): KidChore[] {
  const rank = (c: KidChore) =>
    c.state === 'done' ? 3 : c.state === 'needs_you' ? 2 : c.due_at && Date.parse(c.due_at) < now ? 0 : 1
  const t = (c: KidChore) => (c.due_at ? Date.parse(c.due_at) : Infinity)
  return chores
    .filter((c) => c.state !== 'skipped')
    .sort((a, b) => rank(a) - rank(b) || (t(a) === t(b) ? 0 : t(a) < t(b) ? -1 : 1) || a.id - b.id)
}

export function tally(chores: KidChore[]) {
  const live = chores.filter((c) => c.state !== 'skipped')
  const approved = live.filter((c) => c.state === 'done').length
  const waiting = live.filter((c) => c.state === 'needs_you').length
  return { approved, total: live.length, left: live.length - approved, todo: live.length - approved - waiting, waiting }
}

/** Little header: 4 big stars. Filled = progress fraction; all 4 only when every chore is done. */
export function starsFilled(approved: number, total: number) {
  if (total <= 0) return 0
  return approved >= total ? 4 : Math.min(3, Math.round((approved / total) * 4))
}
