import { IconMessage } from '@tabler/icons-react'
import { refOf, type ThreadSummary } from '@/v2/hooks/useChat'

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Nothing yet'

const LABEL = { family: 'Family', private: 'Private', chore: 'Chore' } as const

/** Threads with unread badges and last activity; `selected` is "kind:ref". */
export function ThreadList({
  threads,
  selected,
  onPick,
}: {
  threads: ThreadSummary[]
  selected: string | null
  onPick: (t: ThreadSummary) => void
}) {
  return (
    <ul aria-label="Conversations" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {threads.map((t) => {
        const key = `${t.kind}:${refOf(t)}`
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onPick(t)}
              aria-current={selected === key ? 'true' : undefined}
              className="f-row"
              style={{
                width: '100%', minHeight: 48, flexWrap: 'nowrap', textAlign: 'left', cursor: 'pointer', padding: '8px 10px',
                border: '1.5px solid var(--f-edge)', borderRadius: 6, background: selected === key ? 'var(--f-mute)' : 'var(--f-card)', color: 'inherit', font: 'inherit',
              }}
            >
              <IconMessage size={18} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{t.title}</b>
                <span className="f-cap" style={{ display: 'block' }}>{`${LABEL[t.kind]} · ${when(t.last_message_at)}`}</span>
                {t.last_text && (
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--f-sub)' }}>
                    {`${t.last_author ? `${t.last_author}: ` : ''}${t.last_text}`}
                  </span>
                )}
              </span>
              {t.unread > 0 && (
                <span className="f-pill" data-testid={`unread-${t.id}`} aria-label={`${t.unread} unread`}>
                  {t.unread}
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
