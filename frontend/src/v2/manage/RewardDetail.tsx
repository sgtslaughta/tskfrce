import { useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { EmojiPicker } from '@/v2/components/EmojiPicker'
import { useDeleteReward, useSaveReward } from '@/v2/hooks/useRewards'
import { Chip } from '@/v2/parent/Chip'
import { Icon } from '@/v2/parent/Icon'
import type { Reward } from '@/v2/types'
import { ConfirmDelete } from './ConfirmDelete'
import { intError } from './choreMeta'
import { toastFail, toastOk } from '../notify'

/** Add or edit one reward in the catalogue. `reward` omitted = new. */
export function RewardDetail({ reward, onSelect }: { reward?: Reward; onSelect: (id: number | null) => void }) {
  const save = useSaveReward()
  const del = useDeleteReward()
  const [name, setName] = useState(reward?.name ?? '')
  const [price, setPrice] = useState(String(reward?.price ?? 50))
  const [icon, setIcon] = useState(reward?.icon ?? '')
  const [confirm, { open, close }] = useDisclosure(false)
  const priceErr = intError(price, 1, 100000)

  const submit = () =>
    save.mutate(
      { id: reward?.id, body: { name: name.trim(), price: Number(price), ...(icon !== (reward?.icon ?? '') && { icon }) } },
      {
        onError: toastFail,
        onSuccess: (r) => {
          toastOk(reward ? 'Saved' : 'Added')
          if (!reward) onSelect((r as { id: number }).id)
        },
      },
    )

  return (
    <div className="pk-detail">
      <header className="pk-head">
        <span className="pk-tile pk-tile-lg">
          {icon || <Icon name="redeem" size={30} />}
        </span>
        <div className="pk-head-t">
          <h2>{name.trim() || 'New reward'}</h2>
          <div className="pk-chips">
            <Chip tone="acc" icon="stars">
              {priceErr ? 0 : Number(price)} pts
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
              onClick={open}
            >
              <Icon name="delete" />
              Delete reward
            </button>
            <ConfirmDelete
              opened={confirm}
              title={`Delete ${reward.name}?`}
              body="Kids won't see it any more. Requests already made stay in history."
              onConfirm={() => del.mutate(reward.id, { onError: toastFail, onSuccess: () => (toastOk('Deleted'), onSelect(null)) })}
              onClose={close}
            />
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
          <input className="pk-input" aria-label="Price (points)" inputMode="numeric" value={price} aria-invalid={!!priceErr} aria-describedby={priceErr ? 'rw-err' : undefined} onChange={(e) => setPrice(e.currentTarget.value)} />
          {priceErr && <span id="rw-err" className="pk-error">{priceErr}</span>}
        </label>
        <EmojiPicker label="Icon (an emoji kids see)" value={icon} onChange={setIcon} />
        <div className="pk-actions">
          <button
            type="button"
            className="p-btn"
            data-variant="accent"
            onClick={submit}
            disabled={!name.trim() || !!priceErr || save.isPending}
            aria-busy={save.isPending}
          >
            <Icon name={save.isPending ? 'progress_activity' : 'check'} className={save.isPending ? 'pk-spin' : ''} />
            {save.isPending ? 'Saving…' : reward ? 'Save reward' : 'Add reward'}
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
