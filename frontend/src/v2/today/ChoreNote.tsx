import { useState } from 'react'
import type { TodayChore } from '../types'
import { Icon } from '../parent/Icon'
import { openChat } from '../chat/dock'
import { withUndo } from '../notify'
import { useMoveChore, useSkipChore } from '../hooks/useToday'
import { useClock } from './useClock'

type Note = NonNullable<TodayChore['note']>

/** "Mia: Out of supplies · “No more toilet spray” · 5:12 PM" */
export const noteText = (n: Note, clock: (iso: string) => string) =>
  [`${n.kid_name ?? 'Your kid'}: ${n.label}`, n.text && `“${n.text}”`, clock(n.at)].filter(Boolean).join(' · ')

/** The kid's note under the chore title, in amber with the chore type's glyph. */
export function NoteLine({ chore }: { chore: TodayChore }) {
  const clock = useClock()
  if (!chore.note) return null
  return (
    <span className="pt-note">
      <Icon name={chore.type?.glyph ?? 'flag'} size={16} />
      {noteText(chore.note, clock)}
    </span>
  )
}

/** Move to tomorrow / Skip today buttons; Move hides when tomorrow already has this chore. */
export function MoveSkip({ chore }: { chore: TodayChore }) {
  const move = useMoveChore()
  const skip = useSkipChore()
  const [busy, setBusy] = useState(false) // covers the Undo window, before the mutation starts
  const later = (run: () => Promise<unknown>, message: string) => {
    setBusy(true)
    void withUndo(run, message).finally(() => setBusy(false))
  }
  return (
    <>
      {chore.can_move && (
        <button
          type="button"
          className="p-btn"
          disabled={busy || move.isPending}
          data-loading={move.isPending}
          onClick={() => later(() => move.mutateAsync(chore.id), 'Moved to tomorrow')}
        >
          <Icon name="event_repeat" size={17} />
          Move to tomorrow
        </button>
      )}
      <button
        type="button"
        className="p-btn"
        disabled={busy || skip.isPending}
        data-loading={skip.isPending}
        onClick={() => later(() => skip.mutateAsync(chore.id), 'Skipped for today')}
      >
        <Icon name="do_not_disturb_on" size={17} />
        Skip today<span className="pt-fine">(no penalty)</span>
      </button>
    </>
  )
}

/** Actions under a flagged chore (mockup 03): Reply, Move to tomorrow, Skip today. */
export function ChoreNote({ chore }: { chore: TodayChore }) {
  if (!chore.note) return null
  return (
    <div className="pt-note-acts">
      <button type="button" className="p-btn" onClick={() => openChat('chore', String(chore.id))}>
        <Icon name="chat" size={17} />
        Reply
      </button>
      {chore.state === 'todo' && <MoveSkip chore={chore} />}
    </div>
  )
}
