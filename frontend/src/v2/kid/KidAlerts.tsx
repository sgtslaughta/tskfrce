import { Icon } from '@/v2/parent/Icon'
import { useInbox, useMarkAllRead, useMarkRead, type InboxItem } from '../hooks/useInbox'
import { openChat, openChatList } from '../chat/dock'

const GLYPH: Record<string, string> = {
  due_soon: 'hourglass_bottom',
  missed_deadline: 'alarm',
  lock_warning: 'lock_clock',
  chore_new: 'fiber_new',
  chore_approved: 'check_circle',
  chore_sent_back: 'undo',
  points_taken: 'remove_circle',
  chat_message: 'chat',
  redemption_decided: 'redeem',
  badge_earned: 'military_tech',
  level_up: 'trending_up',
}

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return m < 1 ? 'now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`
}

/** Kid Alerts page: own inbox, newest first. Tapping a row reads it and goes where it points. */
export function KidAlerts({ onChores }: { onChores: () => void }) {
  const inbox = useInbox(true)
  const read = useMarkRead(true)
  const readAll = useMarkAllRead(true)
  const items = inbox.data?.items ?? []
  const go = (n: InboxItem) => {
    if (!n.read) read.mutate(n.id)
    if (n.kind === 'chat_message') return n.run_id ? openChat('chore', String(n.run_id)) : openChatList()
    if (n.run_id) onChores()
  }
  return (
    <section className="k-view k-alerts">
      <div className="k-alerts-hd">
        <h1 className="k-hi k-disp">Alerts</h1>
        {(inbox.data?.unread ?? 0) > 0 && (
          <button type="button" className="k-tell" onClick={() => readAll.mutate(undefined)}>
            <Icon name="done_all" />
            Mark all read
          </button>
        )}
      </div>
      {inbox.isPending ? null : items.length ? (
        <ul className="k-alist">
          {items.map((n) => (
            <li key={n.id}>
              <button type="button" className="k-arow" data-unread={!n.read || undefined} onClick={() => go(n)}>
                <span className="k-aic" data-kind={n.kind}>
                  <Icon name={GLYPH[n.kind] ?? 'notifications'} />
                </span>
                <span className="k-atx">
                  <b>{n.title}</b>
                  {n.body && <span>{n.body}</span>}
                  <small>{ago(n.created_at)}</small>
                </span>
                {!n.read && <span className="k-adot" aria-label="Unread" />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="k-hint">
          {inbox.isError ? "Can't load alerts right now." : 'Nothing new. Alerts about your chores show up here.'}
        </p>
      )}
    </section>
  )
}
