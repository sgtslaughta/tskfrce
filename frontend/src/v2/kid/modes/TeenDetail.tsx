import { useState } from 'react'
import { Icon } from '@/v2/parent/Icon'
import { useThread } from '../../hooks/useChat'
import { useAsKid } from '../../hooks/usePreview'
import type { KidChore, KidToday } from '../../types'
import { DeductionCards, NoteSent, PhotoButton, SentBackCard, isReady } from '../ChoreParts'
import { KidChip } from '../KidChip'
import { clock, kidChips, stepBadge } from '../kidChips'
import { KidSteps } from '../KidSteps'
import { TellParentSheet } from '../TellParent'
import { glyph } from './ChoreTile'

/** "Steps · in order 1 → 3", or "Steps" when nothing is chained. */
function stepsTitle(c: KidChore): string {
  const steps = c.subtasks ?? []
  const nums = steps.map((_, i) => stepBadge(steps, i)).filter((b) => b !== '–')
  return nums.length ? `Steps · in order ${nums[0]} → ${nums[nums.length - 1]}` : 'Steps'
}

/** Newest user message on the chore thread. Mounted only off-preview (kid token). */
function Latest({ c, tz }: { c: KidChore; tz?: string }) {
  const q = useThread('chore', String(c.id), true)
  const m = q.data?.messages.filter((x) => x.kind === 'user').at(-1)
  const text = m && (m.body || m.note_label || (m.photo_url ? 'Photo' : null))
  if (!m || !text) return null
  return (
    <div>
      <div className="t-sect">Latest</div>
      <div className="t-msg">
        <small>{`${m.author_name ?? 'Someone'} · ${clock(m.created_at, tz)}`}</small>
        {text}
      </div>
    </div>
  )
}

export interface TeenDetailProps {
  c: KidChore
  d: KidToday
  now: number
  onBack?: () => void
  onDone: (id: number) => void
  busyId: number | null
  onChat?: (id: number) => void
}

/** Detail panel (11 .detail): header, cards, steps, photo, latest message, actions. */
export function TeenDetail({ c, d, now, onBack, onDone, busyId, onChat }: TeenDetailProps) {
  const Title = onBack ? 'h1' : 'h2' // phone shows the detail alone, so it carries the page h1
  const [tell, setTell] = useState(false)
  const preview = useAsKid() !== null
  const act = c.state === 'todo' && !c.taken_by
  const ready = isReady(c)
  const chat = onChat ? () => onChat(c.id) : undefined
  const wait = c.taken_by ? `Taken by ${c.taken_by}` : c.state === 'needs_you' ? 'Waiting for Mom or Dad' : null
  return (
    <div className="t-detail">
      {onBack && (
        <button type="button" className="t-back" onClick={onBack}>
          <Icon name="arrow_back" />
          All chores
        </button>
      )}
      <div className="t-dh">
        <span className="t-ty">
          <Icon name={glyph(c)} />
        </span>
        <div>
          <Title className="k-disp">{c.title}</Title>
          <div className="t-chips">
            {kidChips(c, now, d.timezone, false, true).map((k) => (
              <KidChip key={k.tone} chip={k} size="sm" />
            ))}
            <span className="k-chip" data-tone="today" data-size="sm">{`+${c.points} pts`}</span>
          </div>
        </div>
      </div>
      {!!(c.note || c.last_note || c.deductions?.length) && (
        <div className="k-cards">
          <NoteSent c={c} />
          <SentBackCard c={c} onChat={chat} />
          <DeductionCards c={c} onReply={chat} />
        </div>
      )}
      {(c.subtasks?.length ?? 0) > 0 && (
        <div>
          <div className="t-sect">{stepsTitle(c)}</div>
          <KidSteps c={c} timezone={d.timezone} size="small" readOnly={!act} />
        </div>
      )}
      {act && c.needs_photo && <PhotoButton c={c} />}
      {!preview && <Latest c={c} tz={d.timezone} />}
      {act ? (
        <div className="t-acts">
          <button
            type="button"
            className="t-btn"
            data-tone={ready ? 'sun' : 'off'}
            disabled={!ready || busyId === c.id}
            onClick={() => onDone(c.id)}
          >
            <Icon name="task_alt" />
            {ready ? 'Mark done' : 'Mark done · finish steps first'}
          </button>
          {!!c.notes?.length && (
            <button type="button" className="t-btn" onClick={() => setTell(true)}>
              <Icon name="campaign" />
              Tell Mom/Dad
            </button>
          )}
          {onChat && (
            <button type="button" className="t-btn" onClick={() => onChat(c.id)}>
              <Icon name="forum" />
              Chat
            </button>
          )}
          {!!c.notes?.length && <TellParentSheet c={c} opened={tell} onClose={() => setTell(false)} />}
        </div>
      ) : (
        wait && <p className="t-wait">{wait}</p>
      )}
    </div>
  )
}
