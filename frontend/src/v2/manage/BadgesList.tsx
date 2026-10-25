import { Icon } from '@/v2/parent/Icon'
import type { CustomBadge } from '@/v2/types'

interface Props {
  badges: CustomBadge[]
  selected?: string
  onSelect: (id: number | 'new') => void
}

/** Custom badge cards (glyph tile, name, description) and the dashed "New badge" card. */
export function BadgesList({ badges, selected, onSelect }: Props) {
  return (
    <div className="pk-items">
      {badges.map((b) => (
        <button key={b.id} type="button" className="pk-card" data-selected={selected === String(b.id)} onClick={() => onSelect(b.id)}>
          <span className="pk-tile">
            <Icon name={b.icon} size={20} />
          </span>
          <span className="pk-card-t">
            <b>{b.name}</b>
            {b.description && <small>{b.description}</small>}
          </span>
        </button>
      ))}
      <button type="button" className="pk-card pk-new" data-selected={selected === 'new'} onClick={() => onSelect('new')}>
        <Icon name="add" size={18} />
        New badge
      </button>
    </div>
  )
}
