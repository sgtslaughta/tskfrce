import { useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { GlyphPicker } from '@/v2/parent/GlyphPicker'
import { Icon } from '@/v2/parent/Icon'
import { useAwardBadge, useDeleteBadge, useSaveBadge } from '@/v2/hooks/useCustomBadges'
import { TIER_NAMES } from '@/v2/tiers'
import type { CustomBadge, Kid } from '@/v2/types'
import { ConfirmDelete } from './ConfirmDelete'
import { initial, nameOf } from './choreMeta'
import { toastFail, toastOk } from '../notify'

const tierName = (t: number) => TIER_NAMES[t - 1].replace(/^./, (c) => c.toUpperCase())
const BADGE_GLYPHS = ['military_tech', 'verified', 'star', 'favorite', 'emoji_events', 'trophy', 'celebration']

/** Add or edit one custom badge, and award it to a kid (+1 tier). `badge` omitted = new. */
export function BadgeDetail({ badge, kids, onSelect }: { badge?: CustomBadge; kids: Kid[]; onSelect: (id: number | null) => void }) {
  const save = useSaveBadge()
  const del = useDeleteBadge()
  const award = useAwardBadge()
  const [name, setName] = useState(badge?.name ?? '')
  const [icon, setIcon] = useState(badge?.icon ?? '')
  const [description, setDescription] = useState(badge?.description ?? '')
  const [kid, setKid] = useState<number | null>(null)
  const [confirm, { open, close }] = useDisclosure(false)

  const submit = () =>
    save.mutate(
      { id: badge?.id, body: { name: name.trim(), icon: icon.trim(), description: description.trim() } },
      {
        onError: toastFail,
        onSuccess: (r) => {
          toastOk(badge ? 'Saved' : 'Added')
          if (!badge) onSelect((r as { id: number }).id)
        },
      },
    )
  const give = () =>
    award.mutate(
      { id: badge!.id, kid_id: kid! },
      { onError: toastFail, onSuccess: (r) => toastOk(`${badge!.name}: ${tierName(r.tier)}`) },
    )

  return (
    <div className="pk-detail">
      <header className="pk-head">
        <span className="pk-tile pk-tile-lg">
          <Icon name={icon || 'military_tech'} size={30} />
        </span>
        <div className="pk-head-t">
          <h2>{name.trim() || 'New badge'}</h2>
        </div>
        {badge && (
          <div className="pk-actions">
            <button
              type="button"
              className="p-btn"
              data-variant="red"
              disabled={del.isPending}
              onClick={open}
            >
              <Icon name="delete" />
              Delete badge
            </button>
            <ConfirmDelete
              opened={confirm}
              title={`Delete ${badge.name}?`}
              body="Kids who earned it lose it."
              onConfirm={() => del.mutate(badge.id, { onError: toastFail, onSuccess: () => (toastOk('Deleted'), onSelect(null)) })}
              onClose={close}
            />
          </div>
        )}
      </header>
      <div className="pk-grid">
        <section className="pk-panel" aria-label="Badge">
          <h3>
            <Icon name="edit" size={18} />
            Badge
          </h3>
          <label className="pk-field">
            <span className="pk-label">Badge name</span>
            <input className="pk-input" value={name} maxLength={60} onChange={(e) => setName(e.currentTarget.value)} />
          </label>
          <div className="pk-field">
            <span className="pk-label">Icon</span>
            <GlyphPicker value={icon} onChange={setIcon} choices={BADGE_GLYPHS} />
          </div>
          <label className="pk-field">
            <span className="pk-label">Description</span>
            <input className="pk-input" value={description} maxLength={200} onChange={(e) => setDescription(e.currentTarget.value)} />
          </label>
          <div className="pk-actions">
            <button type="button" className="p-btn" data-variant="accent" onClick={submit} disabled={!name.trim() || !icon.trim() || save.isPending} aria-busy={save.isPending}>
              <Icon name={save.isPending ? 'progress_activity' : 'check'} className={save.isPending ? 'pk-spin' : ''} />
              {save.isPending ? 'Saving…' : badge ? 'Save badge' : 'Add badge'}
            </button>
            {!badge && (
              <button type="button" className="p-btn" onClick={() => onSelect(null)}>
                Cancel
              </button>
            )}
          </div>
        </section>

        {badge && (
          <section className="pk-panel" aria-label="Award">
            <h3>
              <Icon name="workspace_premium" size={18} />
              Award it
            </h3>
            <span className="pk-hint">Each award moves the kid up one tier of this badge.</span>
            <div className="pk-pills" role="group" aria-label="Award to">
              {kids.map((k) => (
                <button key={k.id} type="button" className="pk-pill" aria-pressed={kid === k.id} onClick={() => setKid(k.id)}>
                  <span className="pk-av" aria-hidden="true">{initial(nameOf(k))}</span>
                  {nameOf(k)}
                </button>
              ))}
            </div>
            <div className="pk-actions">
              <button type="button" className="p-btn" data-variant="accent" disabled={kid === null || award.isPending} aria-busy={award.isPending} onClick={give}>
                <Icon name={award.isPending ? 'progress_activity' : 'military_tech'} className={award.isPending ? 'pk-spin' : ''} />
                {award.isPending ? 'Awarding…' : 'Award'}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
