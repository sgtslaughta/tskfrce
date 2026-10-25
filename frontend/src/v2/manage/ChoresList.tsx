import { Icon } from '@/v2/parent/Icon'
import { choreIcon } from '@/v2/today/choreIcon'
import type { Kid, LibChore } from '@/v2/types'
import { choreLine, initial, nameOf, usedBy } from './choreMeta'

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
  return (
    <div className="pk-items">
      {chores.map((c) => {
        const ids = usedBy(c)
        return (
          <button key={c.id} type="button" className="pk-card" data-selected={selected === String(c.id)} onClick={() => onSelect(c.id)}>
            <span className="pk-tile">
              <Icon name={choreIcon(c.title)} size={20} />
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
      })}
      <button type="button" className="pk-card pk-new" data-selected={selected === 'new'} onClick={() => onSelect('new')}>
        <Icon name="add" size={18} />
        New chore
      </button>
    </div>
  )
}
