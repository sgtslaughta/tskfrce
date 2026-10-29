import { useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { GlyphPicker } from '@/v2/parent/GlyphPicker'
import { BADGE_GLYPHS } from '@/v2/parent/glyphs'
import { Icon } from '@/v2/parent/Icon'
import { useDeleteBadge, useSaveBadge } from '@/v2/hooks/useCustomBadges'
import type { CustomBadge } from '@/v2/types'
import { ConfirmDelete } from './ConfirmDelete'
import { useSingle } from './useSingle'
import { toastFail, toastOk } from '../notify'

/** Editor card for one custom badge (name, description, glyph). `badge` omitted = new. */
export function BadgeDetail({ badge, onSelect }: { badge?: CustomBadge; onSelect: (id: number | null) => void }) {
  const save = useSaveBadge()
  const saveOnce = useSingle(save)
  const del = useDeleteBadge()
  const delOnce = useSingle(del)
  const [name, setName] = useState(badge?.name ?? '')
  const [icon, setIcon] = useState(badge?.icon ?? '')
  const [description, setDescription] = useState(badge?.description ?? '')
  const [confirm, { open, close }] = useDisclosure(false)

  const submit = () =>
    saveOnce(
      { id: badge?.id, body: { name: name.trim(), icon: icon.trim(), description: description.trim() } },
      {
        onError: toastFail,
        onSuccess: (r) => {
          toastOk(badge ? 'Saved' : 'Added')
          if (!badge) onSelect((r as { id: number }).id)
        },
      },
    )

  return (
    <section className="pk-panel" aria-label="Badge details">
      <h3>
        <Icon name={badge ? 'edit' : 'add'} size={18} />
        <span className="rw-grow">{badge ? badge.name : 'New badge'}</span>
        {badge && (
          <button type="button" className="p-btn" data-variant="red" disabled={del.isPending} onClick={open}>
            <Icon name="delete" />
            Delete badge
          </button>
        )}
      </h3>
      {badge && (
        <ConfirmDelete
          opened={confirm}
          title={`Delete ${badge.name}?`}
          body="Kids who earned it lose it."
          onConfirm={() => delOnce(badge.id, { onError: toastFail, onSuccess: () => (toastOk('Deleted'), onSelect(null)) })}
          onClose={close}
        />
      )}
      <label className="pk-field">
        <span className="pk-label">Badge name</span>
        <input className="pk-input" value={name} maxLength={60} onChange={(e) => setName(e.currentTarget.value)} />
      </label>
      <label className="pk-field">
        <span className="pk-label">Description</span>
        <input className="pk-input" value={description} maxLength={200} onChange={(e) => setDescription(e.currentTarget.value)} />
      </label>
      <div className="pk-field pk-type-icons bd-icons">
        <span className="pk-label">Icon</span>
        <div className="pk-glyph-search">
          <Icon name="search" size={18} />
          <GlyphPicker value={icon} onChange={setIcon} choices={BADGE_GLYPHS} />
        </div>
      </div>
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
  )
}
