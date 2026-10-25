import { useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { useCreateKid, useDeleteKid, usePatchKid, type KidBody } from '@/v2/hooks/useKids'
import { Icon } from '@/v2/parent/Icon'
import type { Kid } from '@/v2/types'
import { EmojiPicker } from '@/v2/components/EmojiPicker'
import { ConfirmDelete } from './ConfirmDelete'
import { toastFail, toastOk } from '../notify'

/** Edit a kid, or add one when `kid` is omitted. Only changed fields are sent. */
export function KidEditor({ kid, onDone, onCreated, focusPin }: { kid?: Kid; onDone?: () => void; onCreated?: (id: number) => void; focusPin?: boolean }) {
  const create = useCreateKid()
  const patch = usePatchKid()
  const del = useDeleteKid()
  const [name, setName] = useState(kid?.full_name ?? '')
  const [avatar, setAvatar] = useState(kid?.avatar ?? '')
  const [pin, setPin] = useState('')
  const [letters, setLetters] = useState(false)
  const [confirm, { open, close }] = useDisclosure(false)
  const label = kid?.full_name ?? kid?.username ?? 'this kid'

  const pinBad = pin !== '' && pin.length !== 4

  const save = () => {
    if (pinBad) return
    const body: KidBody = {}
    if (name.trim() !== (kid?.full_name ?? '')) body.full_name = name.trim()
    if (avatar !== (kid?.avatar ?? '')) body.avatar = avatar
    if (pin) body.pin = pin
    const opts = {
      onError: toastFail,
      onSuccess: (res: unknown) => {
        toastOk(kid ? 'Saved' : 'Added')
        setPin('')
        setLetters(false)
        if (!kid) onCreated?.((res as Kid).id)
      },
    }
    if (kid) patch.mutate({ id: kid.id, body }, opts)
    else create.mutate(body, opts)
  }

  return (
    <section className="pk-panel pk-span" aria-label={kid ? 'Edit kid' : 'Add a kid'}>
      <h3 aria-level={kid ? 3 : 2}>
        <Icon name={kid ? 'edit' : 'person_add'} size={18} />
        {kid ? 'Edit kid' : 'Add a kid'}
      </h3>
      <div className="pk-form">
        <label className="pk-field">
          <span className="pk-label">Name</span>
          <input className="pk-input" value={name} maxLength={100} onChange={(e) => setName(e.currentTarget.value)} />
        </label>
        <EmojiPicker label="Avatar (an emoji)" value={avatar} onChange={setAvatar} />
        <label className="pk-field">
          <span className="pk-label">{kid?.has_pin ? 'New PIN (4 digits)' : 'PIN (4 digits)'}</span>
          <input
            className="pk-input"
            type="password"
            autoFocus={focusPin}
            value={pin}
            inputMode="numeric"
            maxLength={4}
            onChange={(e) => {
              setLetters(/\D/.test(e.currentTarget.value))
              setPin(e.currentTarget.value.replace(/\D/g, ''))
            }}
          />
          {kid?.has_pin && !pinBad && <span className="pk-hint">A PIN is set. Enter a new one to change it.</span>}
          {(pinBad || letters) && <span className="pk-error">{letters ? 'A PIN is digits only, exactly 4.' : 'Use exactly 4 digits.'}</span>}
        </label>
        <div className="pk-actions">
          <button
            type="button"
            className="p-btn"
            data-variant="accent"
            onClick={save}
            disabled={!name.trim() || pinBad || create.isPending || patch.isPending}
            aria-busy={create.isPending || patch.isPending}
          >
            <Icon name={create.isPending || patch.isPending ? 'progress_activity' : 'check'} className={create.isPending || patch.isPending ? 'pk-spin' : ''} />
            {create.isPending || patch.isPending ? 'Saving…' : kid ? 'Save kid' : 'Add kid'}
          </button>
          {kid?.has_pin && (
            <button
              type="button"
              className="p-btn"
              onClick={() => patch.mutate({ id: kid.id, body: { clear_pin: true } }, { onError: toastFail, onSuccess: () => toastOk('PIN removed') })}
            >
              Remove PIN
            </button>
          )}
          {kid && (
            <button type="button" className="p-btn pk-push" data-variant="red" onClick={open}>
              <Icon name="delete" />
              Delete kid
            </button>
          )}
        </div>
      </div>
      {kid && (
        <ConfirmDelete
          opened={confirm}
          title={`Delete ${label}?`}
          body={`Deleting ${label} removes their chores and frees their devices.`}
          onConfirm={() => del.mutate(kid.id, { onSuccess: onDone })}
          onClose={close}
        />
      )}
    </section>
  )
}
