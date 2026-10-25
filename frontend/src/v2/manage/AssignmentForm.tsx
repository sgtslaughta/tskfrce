import { useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { useDeleteAssignment, useSaveAssignment, type ChoreMode } from '@/v2/hooks/useChores'
import { DAYS } from '@/v2/days'
import { Icon } from '@/v2/parent/Icon'
import { SegmentedControl } from '@/v2/parent/SegmentedControl'
import type { Assignment, Kid } from '@/v2/types'
import { ConfirmDelete } from './ConfirmDelete'
import { initial, nameOf } from './choreMeta'
import { toastFail, toastOk } from '../notify'

const REPEATS = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Some days' },
  { value: 'once', label: 'One time' },
]
const MODES: { value: ChoreMode; label: string; hint: string }[] = [
  { value: 'each', label: 'Each does it', hint: 'Each kid gets their own copy and their own points.' },
  { value: 'race', label: 'First one wins', hint: 'One chore for everyone. The first kid to finish it gets the points.' },
  { value: 'team', label: 'Team effort', hint: 'One chore for everyone. Any kid can tick it, and the points are split evenly.' },
]

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

interface Props {
  kids: Kid[]
  choreId: number
  assignment?: Assignment
  /** Called after a save or remove, and by Cancel (shown only when this form can be dismissed). */
  onClose?: () => void
  dismissable?: boolean
}

/** Who does a chore, how often and by when. Add or edit one assignment. */
export function AssignmentForm({ kids, choreId, assignment: a, onClose, dismissable }: Props) {
  const save = useSaveAssignment()
  const del = useDeleteAssignment()
  const [confirm, { open, close }] = useDisclosure(false)
  const [who, setWho] = useState<string[]>(a?.kid_ids.map(String) ?? [])
  const [mode, setMode] = useState<ChoreMode>(a?.mode ?? 'each')
  const [repeat, setRepeat] = useState<string>(a?.repeat.type ?? 'daily')
  const [days, setDays] = useState<string[]>(a?.repeat.days.map(String) ?? [])
  const [date, setDate] = useState(a?.on_date ?? '')
  const [due, setDue] = useState(a?.due_time ?? '')

  const ready = who.length > 0 && (repeat !== 'weekly' || days.length > 0) && (repeat !== 'once' || !!date)

  const submit = () =>
    save.mutate(
      {
        choreId,
        id: a?.id,
        body: {
          kid_ids: who.map(Number),
          mode: who.length > 1 ? mode : 'each',
          repeat: {
            type: repeat as 'daily' | 'weekly' | 'once',
            days: repeat === 'weekly' ? days.map(Number).sort() : [],
          },
          on_date: repeat === 'once' ? date : null,
          due_time: due || null,
        },
      },
      {
        onError: toastFail,
        onSuccess: () => {
          toastOk(a ? 'Saved' : 'Assigned')
          onClose?.()
        },
      },
    )

  return (
    <div className="pk-form">
      <div className="pk-field">
        <span className="pk-label" id={`who-${a?.id ?? 'new'}`}>Assign to</span>
        <div className="pk-pills" role="group" aria-labelledby={`who-${a?.id ?? 'new'}`}>
          {kids.map((k) => (
            <button
              key={k.id}
              type="button"
              className="pk-pill"
              aria-pressed={who.includes(String(k.id))}
              onClick={() => setWho(toggle(who, String(k.id)))}
            >
              <span className="pk-av" aria-hidden="true">{initial(nameOf(k))}</span>
              {nameOf(k)}
            </button>
          ))}
        </div>
      </div>
      {who.length > 1 && (
        <div className="pk-field">
          <span className="pk-label">With more than one kid</span>
          <div className="pk-seg">
            <SegmentedControl label="Mode" options={MODES} value={mode} onChange={setMode} />
          </div>
          <span className="pk-hint">{MODES.find((m) => m.value === mode)?.hint}</span>
        </div>
      )}
      <div className="pk-field">
        <span className="pk-label">Repeat</span>
        <div className="pk-seg">
          <SegmentedControl label="Repeat" options={REPEATS} value={repeat} onChange={setRepeat} />
        </div>
      </div>
      {repeat === 'weekly' && (
        <div className="pk-days" role="group" aria-label="Days">
          {DAYS.map((d, i) => (
            <button
              key={d}
              type="button"
              className="pk-day"
              aria-label={d}
              aria-pressed={days.includes(String(i))}
              onClick={() => setDays(toggle(days, String(i)))}
            >
              {d[0]}
            </button>
          ))}
        </div>
      )}
      <div className="pk-row2">
        {repeat === 'once' && (
          <label className="pk-field">
            <span className="pk-label">Date</span>
            <input className="pk-input" type="date" value={date} onChange={(e) => setDate(e.currentTarget.value)} />
          </label>
        )}
        <label className="pk-field">
          <span className="pk-label">Due by (optional)</span>
          <input className="pk-input" type="time" value={due} onChange={(e) => setDue(e.currentTarget.value)} />
        </label>
      </div>
      <div className="pk-actions">
        <button type="button" className="p-btn" data-variant="accent" onClick={submit} disabled={!ready || save.isPending}>
          <Icon name="check" />
          Save
        </button>
        {dismissable && (
          <button type="button" className="p-btn" onClick={onClose}>
            Cancel
          </button>
        )}
        {a && (
          <>
            <button type="button" className="p-btn pk-push" data-variant="red" onClick={open}>
              <Icon name="person_remove" />
              Remove
            </button>
            <ConfirmDelete
              opened={confirm}
              title="Remove this assignment?"
              body="The chore stays in the library. Chores already done stay in history."
              onConfirm={() => del.mutate(a.id, { onError: toastFail, onSuccess: onClose })}
              onClose={close}
            />
          </>
        )}
      </div>
    </div>
  )
}
