import { useState } from 'react'
import { useBonus, useDeduct } from '@/v2/hooks/useKids'
import { Icon } from '@/v2/parent/Icon'
import type { Kid } from '@/v2/types'
import { intError, nameOf } from './choreMeta'
import { useSingle } from './useSingle'
import { toastOk } from '../notify'

/** Parent gives (bonus) or takes (deduct) points with a short note the kid sees. */
export function PointsForm({ kid, kind, onClose }: { kid: Kid; kind: 'bonus' | 'deduct'; onClose: () => void }) {
  const bonus = useBonus()
  const bonusOnce = useSingle(bonus)
  const deduct = useDeduct()
  const deductOnce = useSingle(deduct)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const n = Number(amount)
  const err = intError(amount, 1, 500)
  const valid = !err && note.trim() !== ''
  const name = nameOf(kid)
  const give = kind === 'bonus'
  const pending = give ? bonus.isPending : deduct.isPending

  const send = () => {
    const vars = { id: kid.id, amount: n, note: note.trim() }
    const done = () => {
      setAmount('')
      setNote('')
      onClose()
    }
    if (give)
      bonusOnce(vars, {
        onSuccess: () => {
          toastOk(`Sent! ${name} got +${n}`)
          done()
        },
      })
    else
      deductOnce(vars, {
        onSuccess: (r) => {
          toastOk(`${name} lost ${r.deducted} points`)
          done()
        },
      })
  }

  return (
    <section className="pk-panel pk-span" aria-label={give ? 'Bonus points' : 'Deduct points'}>
      <h3>
        <Icon name={give ? 'add_circle' : 'remove_circle'} size={18} />
        {give ? 'Give bonus points' : 'Deduct points'}
      </h3>
      <div className="pk-row2">
        <label className="pk-field">
          <span className="pk-label">Points (1 to 500)</span>
          <input
            className="pk-input"
            inputMode="numeric"
            aria-label="Points (1 to 500)"
            autoFocus
            value={amount}
            aria-invalid={amount !== '' && !!err}
            aria-describedby={amount !== '' && err ? 'pts-err' : undefined}
            onChange={(e) => setAmount(e.currentTarget.value)}
          />
          {amount !== '' && err && <span id="pts-err" className="pk-error">{err}</span>}
        </label>
        <label className="pk-field">
          <span className="pk-label">Why?</span>
          <input className="pk-input" value={note} maxLength={100} onChange={(e) => setNote(e.currentTarget.value)} />
        </label>
      </div>
      <div className="pk-actions">
        <button type="button" className="p-btn" data-variant={give ? 'accent' : 'red'} onClick={send} disabled={!valid || pending} aria-busy={pending}>
          {pending && <Icon name="progress_activity" className="pk-spin" />}
          {pending ? 'Sending…' : give ? 'Send points' : 'Take points'}
        </button>
        <button type="button" className="p-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </section>
  )
}
