import { Icon } from '@/v2/parent/Icon'
import { useChoreTypes } from '@/v2/hooks/useChoreTypes'
import { Fold } from '@/v2/parent/Fold'
import type { Kid, LibChore } from '@/v2/types'
import { choreLine, initial, nameOf, otherType, usedBy } from './choreMeta'

const MAX_AVATARS = 4

interface Props {
  chores: LibChore[]
  kids: Kid[]
  selected?: string
  onSelect: (id: number | 'new') => void
}

/** Chore cards (icon tile, name, summary line, assignee avatars) and the dashed "New chore" card. */
export function ChoresList({ chores, kids, selected, onSelect }: Props) {
  const byId = new Map(kids.map((k) => [k.id, k]))
  const all = useChoreTypes().data ?? []
  // type position order, Other last; chores whose type isn't loaded fall into Other
  const other = otherType(all)
  const order = [...all.filter((t) => t !== other), ...(other ? [other] : [])]
  const known = new Set(all.map((t) => t.id))
  const unknown = chores.filter((c) => !known.has(c.type_id))
  const groups: { key: string; name: string; glyph: string; list: LibChore[] }[] = order.map((t) => ({
    key: String(t.id),
    name: t.name,
    glyph: t.glyph,
    list: [...chores.filter((c) => c.type_id === t.id), ...(t === other ? unknown : [])],
  }))
  if (!other) groups.push({ key: 'rest', name: 'Other', glyph: 'task_alt', list: unknown })
  const glyphOf = new Map(all.map((t) => [t.id, t.glyph]))
  const card = (c: LibChore) => {
        const ids = usedBy(c)
        return (
          <button key={c.id} type="button" className="pk-card" data-selected={selected === String(c.id)} onClick={() => onSelect(c.id)}>
            <span className="pk-tile">
              <Icon name={glyphOf.get(c.type_id) ?? 'task_alt'} size={20} />
            </span>
            <span className="pk-card-t">
              <b>{c.title}</b>
              <small>{choreLine(c)}</small>
            </span>
            <span className="pk-avs">
              {ids.slice(0, MAX_AVATARS).map((id) => {
                const k = byId.get(id)
                const name = k ? nameOf(k) : 'Unknown kid'
                return (
                  <span key={id} className="pk-av" title={name} aria-label={name} role="img">
                    {initial(name)}
                  </span>
                )
              })}
              {ids.length > MAX_AVATARS && <span className="pk-av">+{ids.length - MAX_AVATARS}</span>}
            </span>
          </button>
        )
  }
  return (
    <div className="pk-items">
      {groups
        .filter((g) => g.list.length)
        .map(({ key, name, glyph, list }) => (
          <Fold key={key} title={name} icon={glyph} count={list.length} open={list.some((c) => selected === String(c.id))}>
            {list.map(card)}
          </Fold>
        ))}
      <button type="button" className="pk-card pk-new" data-selected={selected === 'new'} onClick={() => onSelect('new')}>
        <Icon name="add" size={18} />
        New chore
      </button>
    </div>
  )
}
