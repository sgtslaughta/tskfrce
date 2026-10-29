import type { InboxItem } from '../hooks/useInbox'
import { openChat } from '../chat/dock'
import { Icon } from '../parent/Icon'
import { isNeedsYou } from './bellRules'

type Props = {
  n: InboxItem
  busy: boolean
  /** the Send back note box is open for this item */
  sending: boolean
  note: string
  onNote: (v: string) => void
  onApprove: () => void
  /** first click opens the note box, the second sends it */
  onSendBack: () => void
  onDecide: (yes: boolean) => void
  /** mark read, close the bell and go to `to` (null: just close); resolves once the page has changed */
  go: (to: string | null) => Promise<unknown>
}

const Btn = ({ icon, label, onClick, accent, busy, disabled }: { icon: string; label: string; onClick: () => void; accent?: boolean; busy?: boolean; disabled?: boolean }) => (
  <button type="button" className="p-btn" data-variant={accent ? 'accent' : undefined} disabled={busy || disabled} data-loading={accent && busy} onClick={onClick}>
    <Icon name={icon} size={16} />
    {label}
  </button>
)

/** Inline actions on a Today bell item (§3.7); nothing for stale requests. */
export function BellActions({ n, busy, sending, note, onNote, onApprove, onSendBack, onDecide, go }: Props) {
  const needs = isNeedsYou(n)
  const device = n.device_id ? `/devices?item=${n.device_id}` : '/devices'
  let body = null
  if (needs && n.kind === 'chore_submitted')
    body = (
      <>
        {sending && (
          <input className="p-bell-note" aria-label="Note for sending back" placeholder="What should they fix?" value={note} maxLength={500} autoFocus onChange={(e) => onNote(e.target.value)} />
        )}
        <Btn icon="check" label={n.points ? `Approve +${n.points}` : 'Approve'} accent busy={busy} onClick={onApprove} />
        <Btn icon="undo" label="Send back" busy={busy} disabled={sending && !note.trim()} onClick={onSendBack} />
      </>
    )
  else if (needs && n.kind === 'redemption_request')
    body = (
      <>
        <Btn icon="check" label="Approve" accent busy={busy} onClick={() => onDecide(true)} />
        <Btn icon="close" label="Decline" busy={busy} onClick={() => onDecide(false)} />
      </>
    )
  else if (needs && n.kind === 'chore_note' && n.run_id)
    body = <Btn icon="chat" label="Reply" onClick={() => void go(`/?chore=${n.run_id}`).then(() => openChat('chore', String(n.run_id)))} />
  else if (n.kind === 'new_device' && n.pending) body = <Btn icon="person_add" label="Who's this?" onClick={() => go(device)} />
  else if (n.kind === 'device_resisting' || n.kind === 'device_bypass')
    body = (
      <>
        <Btn icon="devices" label="View" onClick={() => go(device)} />
        {n.kid_id && <Btn icon="chat" label={`Ask ${n.kid_name ?? 'kid'}`} onClick={() => void go(null).then(() => openChat('private', String(n.kid_id)))} />}
      </>
    )
  else if (n.kind === 'box_offline') body = <Btn icon="devices" label="View" onClick={() => go('/devices')} />
  return <div className="p-bell-actions">{body}</div>
}
