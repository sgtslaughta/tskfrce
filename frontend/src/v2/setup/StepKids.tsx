import { useState, type KeyboardEvent } from 'react'
import { Button, Group, TextInput } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { api } from '../api'
import { useSingleFlight } from '../hooks/useSingleFlight'
import type { Kid } from '../types'
import { AVATARS } from './starterChores'
import styles from './stepCards.module.css'

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
  const once = useSingleFlight()
  const addKid = () => void once(() => add.mutateAsync().catch(() => {})) // errors show via add.error
  const canAdd = !!name.trim() && !pinBad && !add.isPending
  const enterAdds = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !name.trim()) return
    e.preventDefault() // would otherwise submit the wizard form
    if (canAdd) addKid()
  }
  return (
    <div className={styles.card}>
      {kids.length > 0 && (
        <div className={styles.rows} aria-label="Kids added" role="list">
          {kids.map((k) => (
            <div key={k.id} role="listitem" className={styles.kidrow}>
              <span className={styles.av} aria-hidden="true">{k.avatar}</span>
              <div className={styles.t2}>
                {k.full_name}
                <small>{k.has_pin ? 'PIN set' : 'No PIN'}</small>
              </div>
              <span className={styles.chip}>Added</span>
            </div>
          ))}
        </div>
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
        <Button variant="filled" disabled={!name.trim() || pinBad} loading={add.isPending} onClick={addKid}>Add kid</Button>
      </Group>
    </div>
  )
}
