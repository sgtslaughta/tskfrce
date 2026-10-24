import { useState, useMemo } from 'react'
import { refOf, type ThreadSummary } from '@/v2/hooks/useChat'
import { Icon } from '../parent/Icon'

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Nothing yet'

const LABEL = { family: 'Family', private: 'Private', chore: 'Chore' } as const

type FilterTab = 'all' | 'chores' | 'family'

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

  const counts = {
    chores: threads.filter(t => t.kind === 'chore').length,
    family: threads.filter(t => t.kind === 'family').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      {/* Search box */}
      <input
        type="text"
        placeholder="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search threads"
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1.5px solid var(--p-line)',
          background: 'var(--p-card)',
          color: 'var(--p-ink)',
          font: 'inherit',
        }}
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1.5px solid var(--p-line)' }}>
        {(['all', 'chores', 'family'] as const).map((tab) => (
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
            }}
          >
            {tab === 'all' && 'All'}
            {tab === 'chores' && `Chores · ${counts.chores}`}
            {tab === 'family' && `Family · ${counts.family}`}
          </button>
        ))}
      </div>

      {/* Thread list */}
      <ul aria-label="Conversations" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', minHeight: 0 }}>
        {filtered.map((t) => {
          const key = `${t.kind}:${refOf(t)}`
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onPick(t)}
                aria-current={selected === key ? 'true' : undefined}
                className="p-thread-row"
                style={{
                  width: '100%', minHeight: 48, display: 'flex', flexWrap: 'nowrap', textAlign: 'left', cursor: 'pointer', padding: '8px 10px',
                  border: '1.5px solid var(--p-line)', borderRadius: 6, background: selected === key ? 'var(--p-soft)' : 'var(--p-card)', color: 'inherit', font: 'inherit', alignItems: 'center', gap: 12,
                }}
              >
                <Icon name="forum" size={18} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ color: 'var(--p-ink)' }}>{t.title}</b>
                  <span style={{ display: 'block', fontSize: '13px', color: 'var(--p-sub)' }}>{`${LABEL[t.kind]} · ${when(t.last_message_at)}`}</span>
                  {t.last_text && (
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--p-sub)' }}>
                      {`${t.last_author ? `${t.last_author}: ` : ''}${t.last_text}`}
                    </span>
                  )}
                </span>
                {t.unread > 0 && (
                  <span style={{ background: 'var(--p-tact)', color: 'var(--p-tbg)', padding: '2px 8px', borderRadius: 12, fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }} data-testid={`unread-${t.id}`} aria-label={`${t.unread} unread`}>
                    {t.unread}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
