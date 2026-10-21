import { useState } from 'react'
import { Button, PasswordInput, TextInput } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useCreateKid, useDeleteKid, usePatchKid, type KidBody } from '@/v2/hooks/useKids'
import type { Kid } from '@/v2/types'
import { ConfirmDelete } from './ConfirmDelete'
import { toastFail, toastOk } from '../notify'

/** Edit a kid, or add one when `kid` is omitted. Only changed fields are sent. */
export function KidEditor({ kid, onDone }: { kid?: Kid; onDone?: () => void }) {
  const create = useCreateKid()
  const patch = usePatchKid()
  const del = useDeleteKid()
  const [name, setName] = useState(kid?.full_name ?? '')
  const [avatar, setAvatar] = useState(kid?.avatar ?? '')
  const [pin, setPin] = useState('')
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
      onSuccess: () => {
        toastOk(kid ? 'Saved' : 'Added')
        setPin('')
        if (!kid) {
          setName('')
          setAvatar('')
        }
      },
    }
    if (kid) patch.mutate({ id: kid.id, body }, opts)
    else create.mutate(body, opts)
  }

  return (
    <div className="f-card">
      <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
      <TextInput label="Avatar (an emoji)" value={avatar} maxLength={8} onChange={(e) => setAvatar(e.currentTarget.value)} />
      <PasswordInput
        label={kid?.has_pin ? 'New PIN (4 digits)' : 'PIN (4 digits)'}
        value={pin}
        inputMode="numeric"
        maxLength={4}
        onChange={(e) => setPin(e.currentTarget.value.replace(/\D/g, ''))}
        description={kid?.has_pin ? 'A PIN is set. Enter a new one to change it.' : undefined}
        error={pinBad ? 'Use exactly 4 digits.' : undefined}
      />
      <Button onClick={save} disabled={!name.trim() || pinBad} loading={create.isPending || patch.isPending}>
        {kid ? 'Save kid' : 'Add kid'}
      </Button>
      {kid?.has_pin && (
        <Button
          variant="default"
          onClick={() => patch.mutate({ id: kid.id, body: { clear_pin: true } }, { onError: toastFail, onSuccess: () => toastOk('PIN removed') })}
        >
          Remove PIN
        </Button>
      )}
      {kid && (
        <>
          <Button color="fridgeRed" variant="light" onClick={open}>
            Delete kid
          </Button>
          <ConfirmDelete
            opened={confirm}
            title={`Delete ${label}?`}
            body={`Deleting ${label} removes their chores and frees their devices.`}
            onConfirm={() => del.mutate(kid.id, { onSuccess: onDone })}
            onClose={close}
          />
        </>
      )}
    </div>
  )
}
