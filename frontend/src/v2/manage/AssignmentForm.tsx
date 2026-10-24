import { useState } from 'react'
import { Button, Chip, SegmentedControl, TextInput } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useDeleteAssignment, useSaveAssignment, type ChoreMode } from '@/v2/hooks/useChores'
import { DAYS } from '@/v2/days'
import type { Assignment, Kid } from '@/v2/types'
import { ConfirmDelete } from './ConfirmDelete'
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

interface Props {
  kids: Kid[]
  choreId: number
  assignment?: Assignment
  onClose: () => void
}

/** Who does a chore, how often and by when. Add or edit one assignment. */
export function AssignmentForm({ kids, choreId, assignment: a, onClose }: Props) {
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
          onClose()
        },
      },
    )

  return (
    <div className="m-form">
      <div>
        <div className="f-label">Assign to</div>
        <Chip.Group multiple value={who} onChange={setWho}>
          <div className="f-row">
            {kids.map((k) => (
              <Chip key={k.id} value={String(k.id)}>
                {k.full_name ?? k.username}
              </Chip>
            ))}
          </div>
        </Chip.Group>
      </div>
      {who.length > 1 && (
        <div>
          <div className="f-label">When more than one kid</div>
          <SegmentedControl
            fullWidth
            aria-label="Mode"
            data={MODES.map(({ value, label }) => ({ value, label }))}
            value={mode}
            onChange={(v) => setMode(v as ChoreMode)}
          />
          <div className="m-meta">{MODES.find((m) => m.value === mode)?.hint}</div>
        </div>
      )}
      <div>
        <div className="f-label">Repeat</div>
        <SegmentedControl fullWidth aria-label="Repeat" data={REPEATS} value={repeat} onChange={setRepeat} />
      </div>
      {repeat === 'weekly' && (
        <Chip.Group multiple value={days} onChange={setDays}>
          <div className="f-row">
            {DAYS.map((d, i) => (
              <Chip key={d} value={String(i)}>
                {d}
              </Chip>
            ))}
          </div>
        </Chip.Group>
      )}
      {repeat === 'once' && (
        <TextInput type="date" label="Date" value={date} onChange={(e) => setDate(e.currentTarget.value)} />
      )}
      <TextInput type="time" label="Due by (optional)" value={due} onChange={(e) => setDue(e.currentTarget.value)} />
      <div className="m-actions">
        <Button onClick={submit} disabled={!ready} loading={save.isPending}>
          Save
        </Button>
        <Button variant="default" onClick={onClose}>
          Back
        </Button>
        {a && (
          <>
            <Button className="m-push" color="fridgeRed" variant="subtle" onClick={open}>
              Remove
            </Button>
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
