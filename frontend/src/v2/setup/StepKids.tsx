import { useState, type KeyboardEvent } from 'react'
import { Button, Group, TextInput } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { api } from '../api'
import type { Kid } from '../types'
import { AVATARS } from './starterChores'

interface Props {
  kids: Kid[]
  name: string
  onName: (v: string) => void
  draftError?: string
  onAdd: (k: Kid) => void
}

export function StepKids({ kids, name, onName, draftError, onAdd }: Props) {
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [pin, setPin] = useState('')
  const pinBad = pin !== '' && !/^\d{4}$/.test(pin)
  const add = useMutation({
    mutationFn: () =>
      api<Kid>('/kids', { method: 'POST', body: { full_name: name.trim(), avatar, pin: pin || null } }),
    onSuccess: (k) => {
      onAdd(k)
      onName('')
      setPin('')
    },
  })
  const canAdd = !!name.trim() && !pinBad && !add.isPending
  const enterAdds = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !name.trim()) return
    e.preventDefault() // would otherwise submit the wizard form
    if (canAdd) add.mutate()
  }
  return (
    <>
      {kids.length > 0 && (
        <ul aria-label="Kids added" style={{ paddingLeft: 20 }}>
          {kids.map((k) => <li key={k.id}>{k.avatar} {k.full_name}{k.has_pin ? ' (has a PIN)' : ''}</li>)}
        </ul>
      )}
      <TextInput label="Name" value={name} onChange={(e) => onName(e.currentTarget.value)} onKeyDown={enterAdds} error={draftError} />
      <div role="group" aria-label="Pick an avatar" className="f-row" style={{ marginTop: 12 }}>
        {AVATARS.map((a) => (
          <Button key={a} variant={a === avatar ? 'filled' : 'default'} aria-pressed={a === avatar}
            aria-label={`Avatar ${a}`} onClick={() => setAvatar(a)} px={0} w={44}>{a}</Button>
        ))}
      </div>
      <TextInput mt="md" label="PIN (optional)" description="4 digits. Lets a kid prove it's them on a shared device."
        inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.currentTarget.value)} onKeyDown={enterAdds}
        error={pinBad ? 'Use exactly 4 digits.' : undefined} />
      {add.error && <p role="alert">Couldn&apos;t add that kid. {add.error.message}</p>}
      <Group mt="md">
        <Button disabled={!name.trim() || pinBad} loading={add.isPending} onClick={() => add.mutate()}>Add kid</Button>
      </Group>
    </>
  )
}
