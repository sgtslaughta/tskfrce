import { useState, useMemo } from 'react'
import { refOf, useChatSearch, type ThreadSummary } from '@/v2/hooks/useChat'
import { Chip } from '../parent/Chip'
import { Icon } from '../parent/Icon'
import { ListHeader } from '../parent/ListHeader'
import { SegmentedControl } from '../parent/SegmentedControl'
import { EmptyState } from '../parent/states'
import { threadGlyph } from '../today/choreIcon'

type FilterTab = 'all' | 'chores' | 'notes' | 'family'

function Tile({ t }: { t: ThreadSummary }) {
  if (t.kind === 'private') return <b>{(t.title.trim()[0] ?? '?').toUpperCase()}</b>
  return <Icon name={t.kind === 'family' ? 'group' : threadGlyph(t.glyph, t.title)} size={20} />
}

/** Nest each chore under its kid's chat; a chore shared by several kids (or whose kid has no row) goes under Family. */
export function nest(threads: ThreadSummary[]): Array<{ t: ThreadSummary; kids: ThreadSummary[] }> {
  const top = threads.filter((t) => t.kind !== 'chore')
  const home = (c: ThreadSummary) => {
    const ids = c.kid_ids ?? []
    const kid = ids.length === 1 && top.find((t) => t.kind === 'private' && t.kid_id === ids[0])
    return kid || top.find((t) => t.kind === 'family')
  }
  const groups = top.map((t) => ({ t, kids: [] as ThreadSummary[] }))
  const orphans: ThreadSummary[] = []
  for (const c of threads.filter((t) => t.kind === 'chore')) {
    const g = groups.find((x) => x.t === home(c))
    if (g) g.kids.push(c)
    else orphans.push(c)
  }
  return [...groups, ...orphans.map((t) => ({ t, kids: [] }))]
}

/** Threads with search, tabs, and unread badges; `selected` is "kind:ref", `meName` turns "You:" on own lines. */
export function ThreadList({
  threads,
  selected,
  onPick,
  meName,
  kid = false,
}: {
  threads: ThreadSummary[]
  selected: string | null
  onPick: (t: ThreadSummary) => void
  meName?: string
  kid?: boolean
}) {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<Record<number, boolean>>({})
  const found = useChatSearch(search, kid).data?.thread_ids

  const filtered = useMemo(() => {
    let result = threads
    if (filter === 'chores') result = result.filter((t) => t.kind === 'chore')
    else if (filter === 'notes') result = result.filter((t) => t.note)
    else if (filter === 'family') result = result.filter((t) => t.kind === 'family')
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) => t.title.toLowerCase().includes(q) || (t.last_text?.toLowerCase().includes(q) ?? false) || !!found?.includes(t.id),
      )
    }
    return result
  }, [threads, filter, search, found])

  const choreCount = threads.filter((t) => t.kind === 'chore').length
  const noteCount = threads.filter((t) => t.note).length
  const lastLine = (t: ThreadSummary) => {
    if (!t.last_text) return 'No messages yet'
    if (!t.last_author) return t.last_text
    return `${meName && t.last_author === meName ? 'You' : t.last_author}: ${t.last_text}`
  }

  const flat = filter !== 'all' || !!search.trim() // tabs and search list matches flat
  const row = (t: ThreadSummary) => {
    const key = `${t.kind}:${refOf(t)}`
    return (
      <button type="button" className="pc-row" data-selected={selected === key} aria-current={selected === key ? 'true' : undefined} onClick={() => onPick(t)}>
        <span className="pc-tile">
          <Tile t={t} />
        </span>
        <span className="pc-row-t">
          <b>{t.title}</b>
          <span>{lastLine(t)}</span>
        </span>
        {t.note && (
          <Chip tone="amb" icon="flag">
            Note
          </Chip>
        )}
        {t.unread > 0 ? (
          <span className="pc-badge" data-testid={`unread-${t.id}`} aria-label={`${t.unread} unread`}>
            {t.unread}
          </span>
        ) : null}
      </button>
    )
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
            { value: 'notes', label: `Notes · ${noteCount}` },
            { value: 'family', label: 'Family' },
          ]}
        />
      </div>
    </ListHeader>

      {search.trim() && filtered.length === 0 && (
        <EmptyState
          icon="search_off"
          title={`No chats match “${search.trim()}”`}
          body="Try a kid's name or a chore title."
          actions={[{ label: 'Clear search', icon: 'close', onClick: () => setSearch('') }]}
        />
      )}

      <ul aria-label="Conversations" className="pc-rows">
        {flat
          ? filtered.map((t) => <li key={t.id}>{row(t)}</li>)
          : nest(threads).map(({ t, kids }) => {
              // a group starts open when one of its chores is selected or unread
              const shown = open[t.id] ?? kids.some((c) => c.unread > 0 || selected === `chore:${refOf(c)}`)
              const unread = kids.reduce((n, c) => n + c.unread, 0)
              return (
                <li key={t.id} className="pc-group" data-open={shown}>
                  <div className="pc-group-head">
                    {row(t)}
                    {kids.length > 0 && (
                      <button
                        type="button"
                        className="pc-caret"
                        aria-expanded={shown}
                        aria-label={`${shown ? 'Hide' : 'Show'} ${kids.length} chore ${kids.length === 1 ? 'chat' : 'chats'}${unread ? `, ${unread} unread` : ''}`}
                        onClick={() => setOpen({ ...open, [t.id]: !shown })}
                      >
                        <Icon name="expand_more" size={18} />
                        <span>{kids.length}</span>
                        {!shown && unread > 0 && <i className="pc-caret-dot" aria-hidden />}
                      </button>
                    )}
                  </div>
                  {shown && kids.length > 0 && (
                    <ul className="pc-rows pc-sub" aria-label={`Chore chats for ${t.title}`}>
                      {kids.map((c) => (
                        <li key={c.id}>{row(c)}</li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
      </ul>
    </>
  )
}
