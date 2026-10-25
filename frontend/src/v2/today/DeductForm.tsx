import { useRef, useState } from 'react'
import { useDeductChore, useToday } from '../hooks/useToday'
import { toastFail, toastOk } from '../notify'

/** Toast text from what the server really took (capped at the balance). */
export const deductMsg = (taken: number, name: string) =>
  taken > 0 ? `Deducted ${taken} from ${name}` : 'Nothing left to take — balance is 0.'

export const DEDUCT_PRESETS = [5, 10, 20]

/** Inline "Deduct for {chore}" form: kid picker (shared chores), −5 / −10 / −20 / Custom, required reason. */
export function DeductForm({
  runId,
  title,
  kidIds,
  kidId,
  onDone,
}: {
  runId: number
  title: string
  kidIds: number[]
  kidId: number
  onDone: () => void
}) {
  const deduct = useDeductChore()
  const kids = useToday().data?.kids ?? []
  const nameOf = (id: number) => kids.find((k) => k.id === id)?.name ?? 'Kid'
  const [who, setWho] = useState(kidIds.includes(kidId) ? kidId : (kidIds[0] ?? kidId))
  const [amount, setAmount] = useState<number | null>(10) // null = Custom
  const [custom, setCustom] = useState('')
  const [why, setWhy] = useState('')
  const sending = useRef(false) // a double click fires before React re-renders
  const take = amount ?? Number(custom)
  const ok = take >= 1 && take <= 500 && !!why.trim()

  return (
    <form
      className="pt-ded"
      onSubmit={(e) => {
        e.preventDefault()
        if (sending.current || !ok) return
        sending.current = true
        deduct.mutate(
          { id: runId, kid_id: who, amount: take, note: why.trim() },
          {
            onSuccess: (r) => (toastOk(deductMsg(r.deducted, nameOf(who))), onDone()),
            onError: toastFail,
            onSettled: () => (sending.current = false),
          },
        )
      }}
    >
      <b>Deduct for {title}</b>
      {kidIds.length > 1 && (
        <span className="pt-ded-kids" role="group" aria-label="Kid">
          {kidIds.map((id) => (
            <button type="button" key={id} className="pt-amt" data-tone="kid" data-on={who === id} aria-pressed={who === id} onClick={() => setWho(id)}>
              {nameOf(id)}
            </button>
          ))}
        </span>
      )}
      <span className="pt-ded-amts" role="group" aria-label="Amount">
        {DEDUCT_PRESETS.map((a) => (
        <button type="button" key={a} className="pt-amt" data-on={amount === a} aria-pressed={amount === a} onClick={() => setAmount(a)}>
          −{a}
        </button>
      ))}
      <button type="button" className="pt-amt" data-on={amount === null} aria-pressed={amount === null} onClick={() => setAmount(null)}>
        Custom
        </button>
      </span>
      {amount === null && (
        <input
          className="pt-amt-custom"
          inputMode="numeric"
          placeholder="1–500"
          aria-label="Custom amount"
          autoFocus
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
        />
      )}
      <input
        placeholder={`Why? (${nameOf(who)} will see this)`}
        aria-label="Reason"
        value={why}
        maxLength={100}
        onChange={(e) => setWhy(e.target.value)}
      />
      <button className="p-btn" data-variant="red" disabled={!ok || deduct.isPending} data-loading={deduct.isPending}>
        Deduct
      </button>
    </form>
  )
}
