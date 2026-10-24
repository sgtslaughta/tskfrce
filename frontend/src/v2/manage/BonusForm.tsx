import { useState } from 'react'
import { Button, NumberInput, TextInput } from '@mantine/core'
import { useBonus } from '@/v2/hooks/useKids'
import { toastOk } from '../notify'
import type { Kid } from '@/v2/types'

/** Parent gives a kid extra points with a short note. */
export function BonusForm({ kid }: { kid: Kid }) {
  const bonus = useBonus()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState<number | string>('')
  const [note, setNote] = useState('')
  const n = typeof amount === 'number' ? amount : NaN
  const valid = Number.isInteger(n) && n >= 1 && n <= 500 && note.trim() !== ''
  const name = kid.full_name ?? kid.username

  if (!open)
    return (
      <div className="m-actions">
        <Button variant="default" onClick={() => setOpen(true)}>
          Give bonus points
        </Button>
      </div>
    )

  const send = () =>
    bonus.mutate(
      { id: kid.id, amount: n, note: note.trim() },
      {
        onSuccess: () => {
          toastOk(`Sent! ${name} got +${n}`)
          setAmount('')
          setNote('')
          setOpen(false)
        },
      },
    )

  return (
    <div className="m-form">
      <NumberInput label="Points (1 to 500)" value={amount} onChange={setAmount} min={1} max={500} allowDecimal={false} allowNegative={false} clampBehavior="none" />
      <TextInput label="Why?" value={note} maxLength={100} onChange={(e) => setNote(e.currentTarget.value)} />
      <div className="m-actions">
        <Button onClick={send} disabled={!valid} loading={bonus.isPending}>
          Send points
        </Button>
        <Button variant="default" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
