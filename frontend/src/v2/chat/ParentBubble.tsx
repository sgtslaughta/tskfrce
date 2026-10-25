import { Icon } from '@/v2/parent/Icon'
import type { ChatMessage } from '@/v2/hooks/useChat'
import { Photo } from './ChatPhoto'
import { EditBox, MessageActions } from './MessageActions'
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

/** Parent chat bubble: others soft, mine inverse (--p-tbg), system lines centred with a tick. */
export function ParentBubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  const [editing, setEditing] = useState(false)
  if (m.kind === 'system') {
    return (
      <div className="pc-sys" data-testid="msg-system">
        <Icon name="task_alt" size={15} />
        <span>
          {m.body} · {timeLabel(m.created_at)}
        </span>
        {m.photo_url && <Photo url={m.photo_url} className="pc-photo" />}
      </div>
    )
  }
  return (
    <div className="pc-msg" data-mine={mine} data-testid={mine ? 'msg-mine' : 'msg-other'}>
      <MessageActions m={m} mine={mine} kid={false} onEdit={() => setEditing(true)}>
        <small>
          {mine ? 'You' : (m.author_name ?? 'Someone')} · {timeLabel(m.created_at)}
          {m.edited_at && ' · edited'}
        </small>
        {m.photo_url && <Photo url={m.photo_url} className="pc-photo" />}
        {editing ? <EditBox m={m} kid={false} onDone={() => setEditing(false)} /> : m.body}
      </MessageActions>
    </div>
  )
}
