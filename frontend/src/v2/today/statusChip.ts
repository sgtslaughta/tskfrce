import type { ChipTone } from '@/v2/parent/Chip'
import type { ChoreState, TodayChore } from '@/v2/types'

export interface StatusChip {
  tone: ChipTone
  icon: string
  label: string
}

const SOON_MIN = 60

/** Chips for a parent chore row: state first, then note flag, then deduction. */
export function statusChip(
  c: { state: ChoreState } & Pick<TodayChore, 'due_at' | 'sent_back' | 'note' | 'deducted'>,
  now: number,
): StatusChip[] {
  const out: StatusChip[] = []
  if (c.state === 'done') out.push({ tone: 'acc', icon: 'check', label: 'Approved' })
  else if (c.state === 'needs_you') out.push({ tone: 'lav', icon: 'hourglass_top', label: 'Needs OK' })
  else if (c.state === 'skipped') out.push({ tone: 'grey', icon: 'do_not_disturb_on', label: 'Skipped' })
  else if (c.sent_back) out.push({ tone: 'red', icon: 'undo', label: 'Sent back' })
  else {
    const mins = c.due_at ? (Date.parse(c.due_at) - now) / 60000 : Infinity
    if (mins < 0) out.push({ tone: 'red', icon: 'alarm', label: 'Overdue' })
    else if (mins <= SOON_MIN) out.push({ tone: 'amb', icon: 'hourglass_bottom', label: `Due in ${Math.ceil(mins)} min` })
    else if (!c.note) out.push({ tone: 'grey', icon: 'schedule', label: 'To do' }) // the Note chip says it already
  }
  if (c.note) out.push({ tone: 'amb', icon: 'flag', label: 'Note' })
  if (c.deducted) out.push({ tone: 'red', icon: 'remove_circle', label: `−${c.deducted}` })
  return out
}
