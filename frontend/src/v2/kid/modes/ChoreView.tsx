import { useState } from 'react'
import { Icon } from '@/v2/parent/Icon'
import type { KidChore, KidToday } from '../../types'
import { DeductionCards, NoteSent, PhotoButton, SentBackCard, isReady, whyNot } from '../ChoreParts'
import { KidChip, PointsChip } from '../KidChip'
import { kidChips, stepBadge } from '../kidChips'
import { KidSteps } from '../KidSteps'
import { TellParentSheet } from '../TellParent'
import { glyph } from './ChoreTile'

/** "Do steps 1 → 3 in order" span of the numbered (chained) steps, or null. */
function chain(c: KidChore): string | null {
  const steps = c.subtasks ?? []
  const nums = steps.map((_, i) => stepBadge(steps, i)).filter((b) => b !== '–')
  return nums.length ? `Do steps ${nums[0]} → ${nums[nums.length - 1]} in order` : null
}

export interface ChoreViewProps {
  c: KidChore
  d: KidToday
  now: number
  onBack: () => void
  onDone: (id: number) => void
  busyId: number | null
  onChat?: (id: number) => void
}

/** One chore at a time (10 #chore): back pill, header, cards, steps, big actions. */
export function ChoreView({ c, d, now, onBack, onDone, busyId, onChat }: ChoreViewProps) {
  const [tell, setTell] = useState(false)
  const act = c.state === 'todo' && !c.taken_by
  const ready = isReady(c)
  const order = chain(c)
  const chat = onChat ? () => onChat(c.id) : undefined
  const photoMissing = !!c.needs_photo && !(c.photo_count_current ?? 0)
  const chip = kidChips(c, now, d.timezone)[0]
  const wait = c.taken_by ? `Taken by ${c.taken_by}` : c.state === 'needs_you' ? 'Waiting for Mom or Dad' : null
  const acts = 1 + (c.notes?.length ? 1 : 0) + (onChat ? 1 : 0)
  return (
    <>
      <button type="button" className="k-back" onClick={onBack}>
        <Icon name="arrow_back" />
        All chores
      </button>
      <div className="k-chead">
        <span className="k-ticon">
          <Icon name={glyph(c)} />
        </span>
        <div>
          <h2 className="k-disp">{c.title}</h2>
          <div className="k-tmeta">
            <PointsChip points={c.points} long />
            {order && <KidChip chip={{ tone: 'today', icon: 'format_list_numbered', label: order }} />}
            {!act && chip && <KidChip chip={chip} />}
          </div>
        </div>
      </div>
      {(c.note || c.last_note || c.deductions?.length) && (
        <div className="k-cards">
          <NoteSent c={c} />
          <SentBackCard c={c} onChat={chat} />
          <DeductionCards c={c} onReply={chat} />
        </div>
      )}
      {(c.subtasks?.length ?? 0) > 0 && (
        <div className="k-steps-card">
          <KidSteps c={c} timezone={d.timezone} size="big" readOnly={!act} />
        </div>
      )}
      {act && c.needs_photo && <PhotoButton c={c} />}
      {act ? (
        <>
          <div className="k-bigacts" data-n={acts}>
            <button
              type="button"
              className="k-bb"
              data-tone={ready ? 'sun' : 'off'}
              disabled={!ready || busyId === c.id}
              onClick={() => onDone(c.id)}
            >
              <Icon name="task_alt" />
              {"I'm done!"}
            </button>
            {!!c.notes?.length && (
              <button type="button" className="k-bb" onClick={() => setTell(true)}>
                <Icon name="campaign" />
                Tell Mom/Dad
              </button>
            )}
            {onChat && (
              <button type="button" className="k-bb" onClick={() => onChat(c.id)}>
                <Icon name="chat" />
                Chat
              </button>
            )}
          </div>
          {!ready && <p className="k-hint">{photoMissing ? whyNot(c) : 'Finish all the steps to press “I\'m done!”'}</p>}
          {!!c.notes?.length && <TellParentSheet c={c} opened={tell} onClose={() => setTell(false)} />}
        </>
      ) : (
        wait && <p className="k-hint">{wait}</p>
      )}
    </>
  )
}
