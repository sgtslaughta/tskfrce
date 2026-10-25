import type { TodayChore, TodayKid } from '../types'
import { Chip } from '../parent/Chip'
import { Icon } from '../parent/Icon'
import { ChoreOpen } from './ChoreOpen'
import { choreIcon } from './choreIcon'
import { useClock } from './useClock'

const stateChip = (state: string) => {
  if (state === 'done') return <Chip tone="acc" icon="check">Approved</Chip>
  if (state === 'needs_you') return <Chip tone="lav" icon="hourglass_top">Needs OK</Chip>
  return <Chip tone="grey" icon="radio_button_unchecked">To do</Chip>
}

const wall = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

/** "Done 5:40 PM · approved · 3 of 3 steps" / "Due 7:00 PM · 2 of 4 steps" */
export function choreSub(c: TodayChore, clock: (iso: string) => string = (i) => wall(new Date(i))): string {
  const bits: string[] = []
  if (c.done_at) bits.push(`Done ${clock(c.done_at)}`)
  else if (c.due_time) bits.push(`Due ${wall(new Date(`2000-01-01T${c.due_time}`))}`)
  if (c.state === 'done') bits.push('approved')
  if ((c.subtasks_total ?? 0) > 1) bits.push(`${c.subtasks_done ?? 0} of ${c.subtasks_total} steps`)
  if (c.taken_by) bits.push(`by ${c.taken_by}`)
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
  const ticked = chore.state !== 'todo'
  const sub = choreSub(chore, useClock())
  return (
    <div data-testid="chore-row" data-open={isOpen} data-state={chore.state} className="pt-chore">
      <button className="pt-row" onClick={onToggle} aria-expanded={isOpen}>
        <span className="pt-car" aria-hidden>
          <Icon name="chevron_right" size={20} />
        </span>
        <span className="pt-ck" data-on={ticked} aria-hidden>
          {ticked && <Icon name="check" size={16} />}
        </span>
        <span className="pt-ty" aria-hidden>
          <Icon name={choreIcon(chore.title)} size={18} />
        </span>
        <span className="pt-t">
          <span className="pt-title">{chore.title}</span>
          {sub && <small>{sub}</small>}
        </span>
        {stateChip(chore.state)}
        <span className="pt-pts">+{chore.points}</span>
      </button>
      {isOpen && <ChoreOpen chore={chore} kid={kid} />}
    </div>
  )
}
