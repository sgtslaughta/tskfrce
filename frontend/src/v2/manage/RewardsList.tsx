import { Icon } from '@/v2/parent/Icon'
import type { Reward } from '@/v2/types'

interface Props {
  rewards: Reward[]
  selected?: string
  onSelect: (id: number | 'new') => void
}

/** Reward cards (glyph tile, name, price) and the dashed "New reward" card. */
export function RewardsList({ rewards, selected, onSelect }: Props) {
  return (
    <div className="pk-items">
      {rewards.map((r) => (
        <button key={r.id} type="button" className="pk-card" data-selected={selected === String(r.id)} onClick={() => onSelect(r.id)}>
          <span className="pk-tile">
            {r.icon || <Icon name="redeem" size={20} />}
          </span>
          <span className="pk-card-t">
            <b>{r.name}</b>
            <small>{r.price} pts</small>
          </span>
        </button>
      ))}
      <button type="button" className="pk-card pk-new" data-selected={selected === 'new'} onClick={() => onSelect('new')}>
        <Icon name="add" size={18} />
        New reward
      </button>
    </div>
  )
}
