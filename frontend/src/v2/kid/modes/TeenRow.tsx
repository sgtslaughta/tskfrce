import { Icon } from '@/v2/parent/Icon'
import type { KidChore } from '../../types'
import { KidChip } from '../KidChip'
import { clock, kidChips } from '../kidChips'
import { glyph } from './ChoreTile'

/** Second line of a Teen row (11 .nm small). */
export function subline(c: KidChore, now: number, tz?: string): string {
  if (c.state === 'done' || c.state === 'needs_you') return c.done_at ? `Done ${clock(c.done_at, tz)}` : 'Done'
  if (c.due_at && Date.parse(c.due_at) < now) return `Was due ${clock(c.due_at, tz)}`
  const steps = c.subtasks ?? []
  const done = steps.filter((s) => s.done).length
  if (steps.length && done < steps.length) {
    const next = steps.find((s) => !s.done)
    const by = next?.due_at ? ` · next by ${clock(next.due_at, tz)}` : ''
    return `Step ${done + 1} of ${steps.length}${by}`
  }
  if (c.sent_back && c.last_note) return `“${c.last_note}”`
  if (c.new) return 'New today'
  return c.due_at ? `Due ${clock(c.due_at, tz)}` : 'Any time'
}

/** One list row (11 .row): status box, type glyph, name + subline, top chip, points. */
export function TeenRow({
  c,
  now,
  tz,
  selected,
  onSelect,
}: {
  c: KidChore
  now: number
  tz?: string
  selected: boolean
  onSelect: () => void
}) {
  const dim = c.state === 'done' || c.state === 'needs_you'
  const chip = kidChips(c, now, tz)[0]
  return (
    <button type="button" className="t-row" data-done={dim || undefined} aria-pressed={selected} onClick={onSelect}>
      <span className="t-ck">{dim && <Icon name="check" />}</span>
      <span className="t-ty">
        <Icon name={glyph(c)} />
      </span>
      <span className="t-nm">
        <span>{c.title}</span>
        <small>{subline(c, now, tz)}</small>
      </span>
      <span className="t-chip">{chip && <KidChip chip={chip} size="sm" />}</span>
      <span className="t-pts">{`+${c.points}`}</span>
    </button>
  )
}
