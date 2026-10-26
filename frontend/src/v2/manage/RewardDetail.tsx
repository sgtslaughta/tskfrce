import { useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { useDeleteReward, useSaveReward, type RewardBody } from '@/v2/hooks/useRewards'
import { GlyphPicker } from '@/v2/parent/GlyphPicker'
import { REWARD_GLYPHS } from '@/v2/parent/glyphs'
import { Icon } from '@/v2/parent/Icon'
import type { Reward } from '@/v2/types'
import { ConfirmDelete } from './ConfirmDelete'
import { useSingle } from './useSingle'
import { intError } from './choreMeta'
import { toastFail, toastOk } from '../notify'

/** A reward's stored icon as a Material Symbols name; none or not a glyph name → `redeem`. */
export const rewardGlyph = (icon: string | null | undefined) => (icon && /^[a-z0-9_]{1,40}$/.test(icon) ? icon : 'redeem')

/** Mockup 02 switch (`rw-sw`: ink track, accent knob). */
export function Switch({ id, label, on, onChange }: { id: string; label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="pk-switch rw-sw">
      <span id={id}>{label}</span>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={id} onClick={() => onChange(!on)} />
    </div>
  )
}

/** Add or edit one reward in the catalogue. `reward` omitted = new. */
export function RewardDetail({ reward, onSelect }: { reward?: Reward; onSelect: (id: number | null) => void }) {
  const save = useSaveReward()
  const saveOnce = useSingle(save)
  const del = useDeleteReward()
  const delOnce = useSingle(del)
  const [name, setName] = useState(reward?.name ?? '')
  const [price, setPrice] = useState(String(reward?.price ?? 50))
  const [icon, setIcon] = useState(reward?.icon ? rewardGlyph(reward.icon) : '')
  const [visible, setVisible] = useState(reward?.visible ?? true)
  const [approval, setApproval] = useState(reward?.needs_approval ?? true)
  const [confirm, { open, close }] = useDisclosure(false)
  const priceErr = intError(price, 1, 100000)

  const submit = () => {
    const body: RewardBody = { name: name.trim(), price: Number(price) }
    if (icon !== (reward?.icon ?? '')) body.icon = icon
    if (visible !== (reward?.visible ?? true)) body.visible = visible
    if (approval !== (reward?.needs_approval ?? true)) body.needs_approval = approval
    saveOnce(
      { id: reward?.id, body },
      {
        onError: toastFail,
        onSuccess: (r) => {
          toastOk(reward ? 'Saved' : 'Added')
          if (!reward) onSelect((r as { id: number }).id)
        },
      },
    )
  }

  return (
    <section className="pk-panel" aria-label="Reward details">
      <h3>
        <Icon name={reward ? 'edit' : 'add'} size={18} />
        <span className="rw-grow">{reward ? reward.name : 'New reward'}</span>
        {reward && (
          <button type="button" className="p-btn" data-variant="red" disabled={del.isPending} onClick={open}>
            <Icon name="delete" />
            Delete reward
          </button>
        )}
      </h3>
      {reward && (
        <ConfirmDelete
          opened={confirm}
          title={`Delete ${reward.name}?`}
          body="Kids won't see it any more. Requests already made stay in history."
          onConfirm={() => delOnce(reward.id, { onError: toastFail, onSuccess: () => (toastOk('Deleted'), onSelect(null)) })}
          onClose={close}
        />
      )}
      <div className="rw-form">
        <label className="pk-field">
          <span className="pk-label">Reward</span>
          <input className="pk-input" value={name} maxLength={100} onChange={(e) => setName(e.currentTarget.value)} />
        </label>
        <label className="pk-field">
          <span className="pk-label">Price (points)</span>
          <input className="pk-input" aria-label="Price (points)" inputMode="numeric" value={price} aria-invalid={!!priceErr} aria-describedby={priceErr ? 'rw-err' : undefined} onChange={(e) => setPrice(e.currentTarget.value)} />
          {priceErr && <span id="rw-err" className="pk-error">{priceErr}</span>}
        </label>
      </div>
      <div className="pk-field pk-type-icons rw-icons">
        <span className="pk-label">Icon</span>
        <div className="pk-glyph-search">
          <Icon name="search" size={18} />
          <GlyphPicker value={icon || 'redeem'} onChange={setIcon} choices={REWARD_GLYPHS} />
        </div>
      </div>
      <Switch id="rw-visible" label="Kids can see it" on={visible} onChange={setVisible} />
      <Switch id="rw-approval" label="Needs approval" on={approval} onChange={setApproval} />
      {!approval && <span className="pk-hint pk-hint-tight">Points come off right away and you get a ping.</span>}
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
  )
}
