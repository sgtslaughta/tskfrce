import { useState } from 'react'
import { Drawer } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { useDeleteChoreType, useSaveChoreType } from '@/v2/hooks/useChoreTypes'
import { GlyphPicker } from '@/v2/parent/GlyphPicker'
import { Icon } from '@/v2/parent/Icon'
import type { ChoreType } from '@/v2/types'
import { ConfirmDelete } from './ConfirmDelete'
import { UNIVERSAL_NOTES } from './choreMeta'
import { useSingle } from './useSingle'
import { toastFail, toastOk } from '../notify'

const GLYPHS = [
  'cleaning_services', 'school', 'pets', 'restaurant', 'yard', 'music_note', 'self_care', 'task_alt',
  'local_laundry_service', 'directions_car', 'sports_soccer', 'shopping_cart', 'delete', 'water_drop', 'child_care', 'bed',
  'local_florist', 'construction', 'recycling', 'dishwasher', 'checkroom', 'fitness_center', 'brush', 'kitchen',
]
const MAX_NOTES = 8 // backend limit
const MAX_LABEL = 40

interface Props {
  opened: boolean
  /** Omit to create a new type. */
  type?: ChoreType
  onClose: () => void
  /** Called with the created or saved type. */
  onSaved: (t: ChoreType) => void
  onDeleted?: () => void
}

/** Right-hand side panel to create or edit a chore type: name, icon, notes a kid can send. */
export function ChoreTypePanel({ opened, type, onClose, onSaved, onDeleted }: Props) {
  const small = useMediaQuery('(max-width: 480px)')
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={small ? '100%' : 420}
      title={type ? 'Edit chore type' : 'New chore type'}
      classNames={{ content: 'pk-sheet', header: 'pk-sheet', title: 'pk-sheet-title' }}
    >
      <TypeForm type={type} onClose={onClose} onSaved={onSaved} onDeleted={onDeleted} />
    </Drawer>
  )
}

// mounted only while the drawer is open, so every open starts from the type's saved values
function TypeForm({ type, onClose, onSaved, onDeleted }: Omit<Props, 'opened'>) {
  const save = useSaveChoreType()
  const saveOnce = useSingle(save)
  const del = useDeleteChoreType()
  const delOnce = useSingle(del)
  const [confirm, { open, close }] = useDisclosure(false)
  const [name, setName] = useState(type?.name ?? '')
  const [glyph, setGlyph] = useState(type?.glyph ?? 'task_alt')
  const [notes, setNotes] = useState(type?.notes.map((n) => n.label) ?? [])
  const [next, setNext] = useState('')
  const full = notes.length >= MAX_NOTES
  const choices = GLYPHS.includes(glyph) ? GLYPHS : [glyph, ...GLYPHS]

  const add = () => {
    if (next.trim() && !full) setNotes([...notes, next.trim()])
    setNext('')
  }
  const move = (i: number, d: number) => {
    const s = [...notes]
    ;[s[i], s[i + d]] = [s[i + d], s[i]]
    setNotes(s)
  }
  const submit = () =>
    saveOnce(
      { id: type?.id, body: { name: name.trim(), glyph, notes } },
      {
        onError: toastFail,
        onSuccess: (t) => {
          toastOk(type ? 'Saved' : 'Type added')
          onSaved(t)
          onClose()
        },
      },
    )

  return (
    <div className="pk-form">
      <label className="pk-field">
        <span className="pk-label">Name</span>
        <input className="pk-input" value={name} maxLength={MAX_LABEL} onChange={(e) => setName(e.currentTarget.value)} />
      </label>
      <div className="pk-field pk-type-icons">
        <span className="pk-label">Icon</span>
        <span className="pk-hint pk-hint-tight">Search or pick</span>
        <GlyphPicker value={glyph} onChange={setGlyph} choices={choices} />
      </div>
      <div className="pk-field">
        <span className="pk-label">Notes a kid can send</span>
        {notes.map((n, i) => (
          <div key={`${i}-${n}`} className="pk-step pk-note-row">
            <span className="pk-step-t">{n}</span>
            <button type="button" className="pk-ib" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move up ${n}`} title="Move up">
              <Icon name="arrow_upward" size={16} />
            </button>
            <button type="button" className="pk-ib" disabled={i === notes.length - 1} onClick={() => move(i, 1)} aria-label={`Move down ${n}`} title="Move down">
              <Icon name="arrow_downward" size={16} />
            </button>
            <button type="button" className="pk-ib" onClick={() => setNotes(notes.filter((_, j) => j !== i))} aria-label={`Remove ${n}`} title="Remove note">
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
        <div className="pk-add">
          <input
            className="pk-input"
            aria-label="Add a note"
            placeholder={full ? `${MAX_NOTES} notes is the most` : 'Add a note'}
            value={next}
            maxLength={MAX_LABEL}
            disabled={full}
            onChange={(e) => setNext(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          />
          <button type="button" className="p-btn" onClick={add} disabled={!next.trim() || full}>
            <Icon name="add" />
            Add
          </button>
        </div>
      </div>
      <div className="pk-field">
        <span className="pk-label">Added to every type</span>
        {UNIVERSAL_NOTES.map((n) => (
          <div key={n.label} className="pk-step pk-note-row" data-universal>
            <Icon name={n.glyph} size={16} />
            <span className="pk-step-t">{n.label}</span>
          </div>
        ))}
      </div>
      <div className="pk-foot">
        {type && !type.builtin && (
          <button type="button" className="p-btn pk-foot-start" data-variant="red" onClick={open}>
            <Icon name="delete" />
            Delete type
          </button>
        )}
        <button type="button" className="p-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="p-btn" data-variant="accent" onClick={submit} disabled={!name.trim() || save.isPending} aria-busy={save.isPending}>
          <Icon name="check" />
          {type ? 'Save type' : 'Create type'}
        </button>
      </div>
      {type && (
        <ConfirmDelete
          opened={confirm}
          title={`Delete ${type.name}?`}
          body="Chores of this type move to Other."
          onConfirm={() =>
            delOnce(type.id, {
              onError: toastFail,
              onSuccess: () => {
                onDeleted?.()
                onClose()
              },
            })
          }
          onClose={close}
        />
      )}
    </div>
  )
}
