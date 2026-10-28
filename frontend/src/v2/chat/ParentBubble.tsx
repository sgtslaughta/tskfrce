import { Icon } from '@/v2/parent/Icon'
import type { ChatMessage } from '@/v2/hooks/useChat'
import { Photo } from './ChatPhoto'
import { EditBox, MessageActions } from './MessageActions'
import { ReactionChips } from './Reactions'
import { renderMentions } from './mentions'
import { useState } from 'react'

export const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

/** "Today" for the current day, else the weekday and date. */
export const dayName = (iso: string) => {
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString()
    ? 'Today'
    : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export const DaySep = ({ label }: { label: string }) => (
  <div className="pc-day" data-testid="day-sep">
    <span>{label}</span>
  </div>
)

/** Parent chat bubble: others soft, mine inverse (--p-tbg), system lines centred with a tick; `names` = members to bold as @mentions. */
export function ParentBubble({ m, mine, names = [], kid = false, kidName, more = [] }: { m: ChatMessage; mine: boolean; names?: string[]; kid?: boolean; kidName?: string; more?: ChatMessage[] }) {
  const [editing, setEditing] = useState(false)
  if (m.kind === 'system') {
    return (
      <>
        <div className="pc-sys" data-testid="msg-system">
          <Icon name="task_alt" size={15} />
          <span>
            {more.length ? `${more.length + 1} photos added` : m.body} · {timeLabel(m.created_at)}
          </span>
        </div>
        {m.photo_url && (
          // proof photos sit in their adder's bubble, side by side (mockup 02)
          <div className="pc-msg" data-mine={mine} data-testid={mine ? 'msg-mine' : 'msg-other'}>
            <small>
              {mine ? 'You' : (m.author_name ?? kidName ?? 'Kid')} · {timeLabel(m.created_at)}
            </small>
            <div className="pc-pics">
              {[m, ...more].map((x) => x.photo_url && <Photo key={x.id} url={x.photo_url} className="pc-photo" />)}
            </div>
          </div>
        )}
      </>
    )
  }
  return (
    <>
      <div className="pc-msg" data-mine={mine} data-testid={mine ? 'msg-mine' : 'msg-other'}>
        <MessageActions m={m} mine={mine} kid={kid} onEdit={() => setEditing(true)}>
          <small>
            {mine ? 'You' : (m.author_name ?? 'Someone')} · {timeLabel(m.created_at)}
            {m.edited_at && (
              <>
                {' · '}
                <span>edited</span>
              </>
            )}
          </small>
          {m.note_label && (
            <span className="pc-notechip">
              <Icon name="flag" size={14} />
              {`Note: ${m.note_label}`}
            </span>
          )}
          {m.step_title && (
            <span className="pc-quote">
              <Icon name="subdirectory_arrow_right" size={14} />
              {m.step_title}
            </span>
          )}
          {m.proof_photo_n && (
            <span className="pc-quote">
              <Icon name="image" size={14} />
              Photo {m.proof_photo_n}
            </span>
          )}
          {m.photo_url && <Photo url={m.photo_url} className="pc-photo" />}
          {editing ? <EditBox m={m} kid={kid} onDone={() => setEditing(false)} /> : m.body && <span>{renderMentions(m.body, names)}</span>}
        </MessageActions>
      </div>
      <ReactionChips m={m} kid={kid} mine={mine} />
    </>
  )
}
