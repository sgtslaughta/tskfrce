import { useState } from 'react'
import { useDeleteReward, useSaveReward } from '@/v2/hooks/useRewards'
import { Chip } from '@/v2/parent/Chip'
import { Icon } from '@/v2/parent/Icon'
import type { Reward } from '@/v2/types'
import { toastFail, toastOk } from '../notify'

/** Add or edit one reward in the catalogue. `reward` omitted = new. */
export function RewardDetail({ reward, onSelect }: { reward?: Reward; onSelect: (id: number | null) => void }) {
  const save = useSaveReward()
  const del = useDeleteReward()
  const [name, setName] = useState(reward?.name ?? '')
  const [price, setPrice] = useState(String(reward?.price ?? 50))

  const submit = () =>
    save.mutate(
      { id: reward?.id, body: { name: name.trim(), price: Number(price) || 0 } },
      {
        onError: toastFail,
        onSuccess: () => {
          toastOk(reward ? 'Saved' : 'Added')
          if (!reward) onSelect(null)
        },
      },
    )

  return (
    <div className="pk-detail">
      <header className="pk-head">
        <span className="pk-tile pk-tile-lg">
          <Icon name="redeem" size={30} />
        </span>
        <div className="pk-head-t">
          <h2>{name.trim() || 'New reward'}</h2>
          <div className="pk-chips">
            <Chip tone="acc" icon="stars">
              {Number(price) || 0} pts
            </Chip>
          </div>
        </div>
        {reward && (
          <div className="pk-actions">
            <button
              type="button"
              className="p-btn"
              data-variant="red"
              disabled={del.isPending}
              onClick={() => del.mutate(reward.id, { onError: toastFail, onSuccess: () => (toastOk('Deleted'), onSelect(null)) })}
            >
              <Icon name="delete" />
              Delete reward
            </button>
          </div>
        )}
      </header>
      <section className="pk-panel pk-narrow" aria-label="Reward details">
        <h3>
          <Icon name="edit" size={18} />
          Reward
        </h3>
        <label className="pk-field">
          <span className="pk-label">Reward</span>
          <input className="pk-input" value={name} maxLength={100} onChange={(e) => setName(e.currentTarget.value)} />
        </label>
        <label className="pk-field">
          <span className="pk-label">Price (points)</span>
          <input className="pk-input" type="number" min={1} max={100000} value={price} onChange={(e) => setPrice(e.currentTarget.value)} />
        </label>
        <div className="pk-actions">
          <button
            type="button"
            className="p-btn"
            data-variant="accent"
            onClick={submit}
            disabled={!name.trim() || !(Number(price) >= 1) || save.isPending}
          >
            <Icon name="check" />
            {reward ? 'Save reward' : 'Add reward'}
          </button>
          {!reward && (
            <button type="button" className="p-btn" onClick={() => onSelect(null)}>
              Cancel
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
