import { useState, useMemo } from 'react'
import { refOf, type ThreadSummary } from '@/v2/hooks/useChat'
import { Icon } from '../parent/Icon'
import { ListHeader } from '../parent/ListHeader'
import { SegmentedControl } from '../parent/SegmentedControl'
import { EmptyState } from '../parent/states'
import { choreIcon } from '../today/choreIcon'

// ponytail: no Notes tab until kid notes reach the backend (Plan C)
type FilterTab = 'all' | 'chores' | 'family'

function Tile({ t }: { t: ThreadSummary }) {
  if (t.kind === 'private') return <b>{(t.title.trim()[0] ?? '?').toUpperCase()}</b>
  return <Icon name={t.kind === 'family' ? 'group' : choreIcon(t.title)} size={20} />
}

/** Threads with search, tabs, and unread badges; `selected` is "kind:ref", `meName` turns "You:" on own lines. */
export function ThreadList({
  threads,
  selected,
  onPick,
  meName,
}: {
  threads: ThreadSummary[]
  selected: string | null
  onPick: (t: ThreadSummary) => void
  meName?: string
}) {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let result = threads
    if (filter === 'chores') result = result.filter((t) => t.kind === 'chore')
    else if (filter === 'family') result = result.filter((t) => t.kind === 'family')
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((t) => t.title.toLowerCase().includes(q) || (t.last_text?.toLowerCase().includes(q) ?? false))
    }
    return result
  }, [threads, filter, search])

  const choreCount = useMemo(() => threads.filter((t) => t.kind === 'chore').length, [threads])
  const lastLine = (t: ThreadSummary) => {
    if (!t.last_text) return 'No messages yet'
    if (!t.last_author) return t.last_text
    return `${meName && t.last_author === meName ? 'You' : t.last_author}: ${t.last_text}`
  }

  return (
    <>
    <ListHeader title="Chat">
      <label className="pc-search">
        <Icon name="search" size={18} />
        <input type="text" placeholder="Search chats" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search threads" />
      </label>
      <div className="pc-tabs">
        <SegmentedControl
          label="Filter chats"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'chores', label: `Chores · ${choreCount}` },
            { value: 'family', label: 'Family' },
          ]}
        />
      </div>
    </ListHeader>

      {search.trim() && filtered.length === 0 && (
        <EmptyState
          icon="person_search"
          title={`No chats match “${search.trim()}”`}
          body="Try a kid's name or a chore title."
          actions={[{ label: 'Clear search', icon: 'close', onClick: () => setSearch('') }]}
        />
      )}

      <ul aria-label="Conversations" className="pc-rows">
        {filtered.map((t) => {
          const key = `${t.kind}:${refOf(t)}`
          return (
            <li key={t.id}>
              <button type="button" className="pc-row" data-selected={selected === key} aria-current={selected === key ? 'true' : undefined} onClick={() => onPick(t)}>
                <span className="pc-tile">
                  <Tile t={t} />
                </span>
                <span className="pc-row-t">
                  <b>{t.title}</b>
                  <span>{lastLine(t)}</span>
                </span>
                {t.unread > 0 ? (
                  <span className="pc-badge" data-testid={`unread-${t.id}`} aria-label={`${t.unread} unread`}>
                    {t.unread}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
