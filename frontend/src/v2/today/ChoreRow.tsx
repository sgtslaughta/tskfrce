import type { TodayChore, TodayKid } from '../types'
import { Chip } from '../parent/Chip'
import { Icon } from '../parent/Icon'
import { ChoreOpen } from './ChoreOpen'
import { ChoreNote, NoteLine } from './ChoreNote'
import { threadGlyph } from './choreIcon'
import { statusChip } from './statusChip'
import { useClock, useNow } from './useClock'

const wall = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

/** "Done 5:40 PM · approved · 3 of 3 steps" / "Due 7:00 PM · 2 of 4 steps" */
export function choreSub(c: TodayChore, clock: (iso: string) => string = (i) => wall(new Date(i))): string {
  const bits: string[] = []
  if (c.done_at) bits.push(`Done ${clock(c.done_at)}`)
  else if (c.due_time) bits.push(`Due ${wall(new Date(`2000-01-01T${c.due_time}`))}`)
  if (c.state === 'done') bits.push('approved')
  if ((c.subtasks_total ?? 0) > 1) bits.push(`${c.subtasks_done ?? 0} of ${c.subtasks_total} steps`)
  if (c.taken_by) bits.push(`by ${c.taken_by}`)
  if (c.deducted) bits.push(`−${c.deducted} deducted`)
  return bits.join(' · ')
}

/** One chore: collapsed row; the open body (steps, actions, chat) renders under it. */
export function ChoreRow({
  chore,
  kid,
  isOpen,
  onToggle,
}: {
  chore: TodayChore
  kid: TodayKid
  isOpen: boolean
  onToggle: () => void
}) {
  const ticked = chore.state === 'done' || chore.state === 'needs_you'
  const sub = choreSub(chore, useClock())
  const chips = statusChip(chore, useNow())
  const kept = Math.max(0, chore.points - (chore.deducted ?? 0))
  return (
    <div data-testid="chore-row" data-open={isOpen} data-state={chore.state} data-flag={!!chore.note} className="pt-chore">
      <button className="pt-row" onClick={onToggle} aria-expanded={isOpen}>
        <span className="pt-car" aria-hidden>
          <Icon name="chevron_right" size={20} />
        </span>
        <span className="pt-ck" data-on={ticked} aria-hidden>
          {ticked && <Icon name="check" size={16} />}
        </span>
        <span className="pt-ty" aria-hidden>
          <Icon name={threadGlyph(chore.type?.glyph, chore.title)} size={18} />
        </span>
        <span className="pt-t">
          <span className="pt-title">{chore.title}</span>
          {sub && <small>{sub}</small>}
          <NoteLine chore={chore} />
        </span>
        <span className="pt-chips">
          {chips.map((c) => (
            <Chip key={c.label} tone={c.tone} icon={c.icon}>
              {c.label}
            </Chip>
          ))}
        </span>
        <span className="pt-pts">
          {chore.deducted ? (
            <>
              <s>+{chore.points}</s>
              {kept}
            </>
          ) : (
            `+${chore.points}`
          )}
        </span>
      </button>
      <ChoreNote chore={chore} />
      {isOpen && <ChoreOpen chore={chore} kid={kid} />}
    </div>
  )
}
