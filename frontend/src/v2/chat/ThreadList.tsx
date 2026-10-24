import { useState, useMemo } from 'react'
import { refOf, type ThreadSummary } from '@/v2/hooks/useChat'
import { Icon } from '../parent/Icon'

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Nothing yet'

const LABEL = { family: 'Family', private: 'Private', chore: 'Chore' } as const

type FilterTab = 'all' | 'chores' | 'notes' | 'family'

/** Threads with search, tabs, and unread badges; `selected` is "kind:ref". */
export function ThreadList({
  threads,
  selected,
  onPick,
}: {
  threads: ThreadSummary[]
  selected: string | null
  onPick: (t: ThreadSummary) => void
}) {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let result = threads

    // Filter by tab
    if (filter === 'chores') {
      result = result.filter(t => t.kind === 'chore')
    } else if (filter === 'notes') {
      // Notes are chore threads where the last message contains a note indicator
      result = result.filter(t => t.kind === 'chore' && t.last_text?.toLowerCase().includes('note:'))
    } else if (filter === 'family') {
      result = result.filter(t => t.kind === 'family')
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.last_text?.toLowerCase().includes(q) ?? false)
      )
    }

    return result
  }, [threads, filter, search])

  const counts = useMemo(() => ({
    chores: threads.filter(t => t.kind === 'chore').length,
    notes: threads.filter(t => t.kind === 'chore' && t.last_text?.toLowerCase().includes('note:')).length,
    family: threads.filter(t => t.kind === 'family').length,
  }), [threads])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      {/* Search box */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--p-line)', background: 'var(--p-card)', color: 'var(--p-sub)' }}>
        <Icon name="search" size={16} />
        <input
          type="text"
          placeholder="Search chats"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search threads"
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            color: 'var(--p-ink)',
            font: 'inherit',
            outline: 'none',
          }}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1.5px solid var(--p-line)' }}>
        {(['all', 'chores', 'notes', 'family'] as const).map((tab) => {
          let label = tab.charAt(0).toUpperCase() + tab.slice(1);
          if (tab === 'chores') {
            label = `Chores · ${counts.chores}`;
          } else if (tab === 'notes') {
            label = `Notes · ${counts.notes}`;
          }
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              aria-pressed={filter === tab}
              style={{
                padding: '8px 0',
                border: 'none',
                background: 'none',
                color: filter === tab ? 'var(--p-ink)' : 'var(--p-sub)',
                fontWeight: filter === tab ? 600 : 400,
                cursor: 'pointer',
                borderBottom: filter === tab ? '2px solid var(--p-acc)' : 'none',
                font: 'inherit',
                textTransform: 'capitalize',
                fontSize: '13px',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Thread list */}
      <ul aria-label="Conversations" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', minHeight: 0 }}>
        {filtered.map((t) => {
          const key = `${t.kind}:${refOf(t)}`
          const hasNote = t.last_text?.toLowerCase().includes('note:')
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onPick(t)}
                aria-current={selected === key ? 'true' : undefined}
                className="p-thread-row"
                style={{
                  width: '100%', minHeight: 48, display: 'flex', flexWrap: 'nowrap', textAlign: 'left', cursor: 'pointer', padding: '10px 12px',
                  border: '1.5px solid transparent', borderRadius: 12, background: selected === key ? 'var(--p-soft)' : 'var(--p-card)', color: 'inherit', font: 'inherit', alignItems: 'center', gap: 10, transition: 'background-color 150ms ease-out',
                }}
                onMouseEnter={(e) => {
                  if (selected !== key) (e.currentTarget).style.borderColor = 'var(--p-line)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget).style.borderColor = 'transparent';
                }}
              >
                <Icon name={t.kind === 'family' ? 'group' : t.kind === 'private' ? 'person' : 'task'} size={20} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ color: 'var(--p-ink)', fontSize: '14px', fontWeight: 600 }}>{t.title}</b>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--p-sub)' }}>{`${LABEL[t.kind]} · ${when(t.last_message_at)}`}</span>
                  {t.last_text && (
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--p-sub)', fontSize: '12px' }}>
                      {t.last_text}
                    </span>
                  )}
                </span>
                {hasNote ? (
                  <span style={{ background: 'var(--p-amb)', color: 'var(--p-ambink)', padding: '3px 8px', borderRadius: 6, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '0.06em' }} aria-label="Has note">
                    Note
                  </span>
                ) : t.unread > 0 ? (
                  <span style={{ background: 'var(--p-acc)', color: '#292928', padding: '2px 8px', borderRadius: 12, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }} data-testid={`unread-${t.id}`} aria-label={`${t.unread} unread`}>
                    {t.unread}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
