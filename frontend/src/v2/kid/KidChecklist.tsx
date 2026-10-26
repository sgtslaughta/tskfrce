import { useState } from 'react'
import { Icon } from '@/v2/parent/Icon'
import { ChoreChip } from '../components/ChoreChip'
import { statusChip } from '../today/statusChip'
import { DeductionCards, NoteSent, PhotoButton, SentBackCard, isReady, whyNot } from './ChoreParts'
import { KidSteps } from './KidSteps'
import { TellParentSheet } from './TellParent'
import type { KidChore } from '../types'

// parent chip tones -> kid pill tones
const TONE = { acc: 'done', lav: 'wait', amb: 'wait', red: 'late', grey: 'mute' } as const
const ROW = { flexBasis: '100%', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } as const

/** Chore rows for the locked screen. `onDone` omitted = read-only. Replaced by the age modes in Task 12. */
export function KidChecklist({
  chores,
  timezone,
  onDone,
  busyId,
  unread,
  onChat,
}: {
  chores: KidChore[]
  timezone?: string
  onDone?: (id: number) => void
  busyId?: number | null
  /** unread chat count per chore id; with `onChat`, each chore gets a chat icon button */
  unread?: Record<number, number>
  onChat?: (id: number) => void
}) {
  const [tell, setTell] = useState<KidChore | null>(null)
  if (!chores.length)
    return <p style={{ margin: 0, fontSize: 18 }}>No chores today. Enjoy the free time.</p>
  return (
    <div className="k-tok">
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 14 }}>
        {chores.map((c) => {
          const open = c.state === 'todo' && !c.taken_by
          const ready = isReady(c)
          return (
            <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minHeight: 56 }}>
              <ChoreChip state={c.state} />
              <span className="f-display" style={{ flex: '1 1 140px', minWidth: 0, overflowWrap: 'anywhere', fontSize: 22, fontWeight: 600 }}>
                {c.title}
                {c.mode === 'team' && (
                  <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 800, color: 'var(--f-sub)' }}>Team</span>
                )}
              </span>
              <span style={{ fontWeight: 800, color: 'var(--f-sub)' }}>+{c.points}</span>
              {c.taken_by ? (
                <span className="f-pill" data-tone="mute">{`Taken by ${c.taken_by}`}</span>
              ) : (
                <>
                  {c.state === 'needs_you' && <span className="f-pill" data-tone="wait">Waiting for Mom or Dad</span>}
                  {c.state === 'todo' &&
                    statusChip(c, Date.now())
                      .slice(0, 1)
                      .filter((x) => x.label !== 'To do' && !(x.label === 'Sent back' && c.last_note))
                      .map((x) => (
                        <span key={x.label} className="f-pill" data-tone={TONE[x.tone as keyof typeof TONE] ?? 'mute'}>{x.label}</span>
                      ))}
                  {c.state === 'done' && <span className="f-pill" data-tone="done">Done</span>}
                </>
              )}
              {onChat && (
                <button
                  type="button"
                  className="f-iconbtn"
                  aria-label={`Chat about ${c.title}${unread?.[c.id] ? `, ${unread[c.id]} unread` : ''}`}
                  onClick={() => onChat(c.id)}
                >
                  <Icon name="chat" />
                  {!!unread?.[c.id] && <span className="f-iconbtn-dot" aria-hidden="true" />}
                </button>
              )}
              {open && c.last_note && (
                <div style={{ flexBasis: '100%' }}>
                  <SentBackCard c={c} onChat={onChat && (() => onChat(c.id))} />
                </div>
              )}
              {!!c.deductions?.length && (
                <div style={{ flexBasis: '100%', display: 'grid', gap: 8 }}>
                  <DeductionCards c={c} onReply={onChat && (() => onChat(c.id))} />
                </div>
              )}
              {open && !!c.subtasks?.length && (
                <div style={{ flexBasis: '100%' }}>
                  <KidSteps c={c} timezone={timezone} readOnly={!onDone} />
                </div>
              )}
              {open && onDone && c.needs_photo && (
                <div style={{ flexBasis: '100%' }}>
                  <PhotoButton c={c} />
                </div>
              )}
              {open && (onDone || c.note || c.notes?.length) && (
                <div style={ROW}>
                  {onDone && (
                    <button
                      type="button"
                      className="k-cut"
                      disabled={!ready || busyId === c.id}
                      onClick={() => onDone(c.id)}
                      aria-describedby={ready ? undefined : `why-${c.id}`}
                    >
                      Mark done
                    </button>
                  )}
                  {c.note ? (
                    <NoteSent c={c} />
                  ) : (
                    !!c.notes?.length && (
                      <button type="button" className="k-tell" onClick={() => setTell(c)}>
                        <Icon name="campaign" />
                        Tell Mom or Dad
                      </button>
                    )
                  )}
                </div>
              )}
              {open && onDone && !ready && (
                <span id={`why-${c.id}`} style={{ flexBasis: '100%', fontSize: 13, fontWeight: 600, color: 'var(--k-sub)' }}>
                  {whyNot(c)}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {tell && <TellParentSheet c={tell} opened onClose={() => setTell(null)} />}
    </div>
  )
}
