import { useState } from 'react'
import { Button, Checkbox, Chip, Drawer, NumberInput, SegmentedControl, TextInput } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import {
  useCreateChore,
  useDeleteChore,
  usePatchChore,
  type ChoreBody,
  type ChoreDefinition,
  type ChoreMode,
  type Repeat,
} from '@/v2/hooks/useChores'
import { DAYS } from '@/v2/days'
import type { Kid } from '@/v2/types'
import { ConfirmDelete } from './ConfirmDelete'
import { toastFail, toastOk } from '../notify'

const CHOICES = ['Once', 'Daily', 'Weekdays', 'Pick days'] as const
const MODES: { value: ChoreMode; label: string; hint: string }[] = [
  { value: 'each', label: 'Each', hint: 'Each kid gets their own copy and their own points.' },
  { value: 'race', label: 'Race', hint: 'One chore for everyone. The first kid to finish it gets the points.' },
  { value: 'team', label: 'Team', hint: 'One chore for everyone. Any kid can tick it, and the points are split evenly.' },
]
const WEEKDAYS = [0, 1, 2, 3, 4]

function repeatOf(choice: string, picked: string[]): Repeat {
  if (choice === 'Daily') return { type: 'daily', days: [] }
  if (choice === 'Weekdays') return { type: 'weekly', days: WEEKDAYS }
  if (choice === 'Pick days') return { type: 'weekly', days: picked.map(Number).sort() }
  return { type: 'once', days: [] }
}

function choiceOf(r?: Repeat): string {
  if (!r) return 'Daily'
  if (r.type === 'once') return 'Once'
  if (r.type === 'daily') return 'Daily'
  return r.days.join() === WEEKDAYS.join() ? 'Weekdays' : 'Pick days'
}

interface FormProps {
  kids: Kid[]
  chore?: ChoreDefinition
  copy?: boolean
  onCopy: () => void
  onClose: () => void
}

function ChoreForm({ kids, chore, copy, onCopy, onClose }: FormProps) {
  const create = useCreateChore()
  const patch = usePatchChore()
  const del = useDeleteChore()
  const [confirm, { open, close }] = useDisclosure(false)
  const editing = chore && !copy
  const [title, setTitle] = useState(chore ? (copy ? `${chore.title} (copy)` : chore.title) : '')
  const [points, setPoints] = useState<number | string>(chore?.points ?? 10)
  const [choice, setChoice] = useState(choiceOf(chore?.repeat))
  const [picked, setPicked] = useState<string[]>(chore?.repeat.days.map(String) ?? [])
  const [due, setDue] = useState(chore?.due_time ?? '')
  const [who, setWho] = useState<string[]>(chore?.kid_ids.map(String) ?? [])
  const [mode, setMode] = useState<ChoreMode>(chore?.mode ?? 'each')
  const [subs, setSubs] = useState<string[]>(chore?.subtasks ?? [])
  const [next, setNext] = useState('')
  const [photo, setPhoto] = useState(chore?.needs_photo ?? false)

  const ready = title.trim() && who.length > 0 && (choice !== 'Pick days' || picked.length > 0)
  const hint = MODES.find((m) => m.value === mode)?.hint

  const addSub = () => {
    if (next.trim()) setSubs([...subs, next.trim()])
    setNext('')
  }
  const move = (i: number, d: number) => {
    const s = [...subs]
    ;[s[i], s[i + d]] = [s[i + d], s[i]]
    setSubs(s)
  }

  const save = () => {
    const body: ChoreBody = {
      title: title.trim(),
      points: Number(points) || 0,
      kid_ids: who.map(Number),
      mode: who.length > 1 ? mode : 'each',
      subtasks: subs,
      repeat: repeatOf(choice, picked),
      needs_photo: photo,
      ...(editing ? { due_time: due || null } : due && { due_time: due }),
    }
    const opts = {
      onError: toastFail,
      onSuccess: () => {
        toastOk(editing ? 'Saved' : 'Added')
        onClose()
      },
    }
    if (editing) patch.mutate({ id: chore.id, body }, opts)
    else create.mutate(body, opts)
  }

  return (
    <div className="m-form">
      {editing && (
        <div className="m-actions">
          <Button variant="default" onClick={onCopy}>
            Copy
          </Button>
          <Button className="m-push" color="fridgeRed" variant="subtle" onClick={open}>
            Delete
          </Button>
          <ConfirmDelete
            opened={confirm}
            title={`Delete ${chore.title}?`}
            body="This stops the chore repeating. Chores already done stay in the record."
            onConfirm={() => del.mutate(chore.id, { onError: toastFail, onSuccess: onClose })}
            onClose={close}
          />
        </div>
      )}
      <TextInput label="Chore" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
      <div className="f-row">
        <NumberInput label="Points" min={0} value={points} onChange={setPoints} />
        <TextInput type="time" label="Due by (optional)" value={due} onChange={(e) => setDue(e.currentTarget.value)} />
      </div>
      <div>
        <div className="f-label">Repeat</div>
        <SegmentedControl fullWidth aria-label="Repeat" data={[...CHOICES]} value={choice} onChange={setChoice} />
      </div>
      {choice === 'Pick days' && (
        <Chip.Group multiple value={picked} onChange={setPicked}>
          <div className="f-row">
            {DAYS.map((d, i) => (
              <Chip key={d} value={String(i)}>
                {d}
              </Chip>
            ))}
          </div>
        </Chip.Group>
      )}
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
          <div className="m-meta">{hint}</div>
        </div>
      )}
      <div>
        <div className="f-label">Subtasks</div>
        {subs.map((s, i) => (
          <div key={`${i}-${s}`} className="m-sub">
            <span>{s}</span>
            <Button variant="subtle" size="compact-md" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move up ${s}`}>
              ↑
            </Button>
            <Button variant="subtle" size="compact-md" disabled={i === subs.length - 1} onClick={() => move(i, 1)} aria-label={`Move down ${s}`}>
              ↓
            </Button>
            <Button variant="subtle" size="compact-md" onClick={() => setSubs(subs.filter((_, j) => j !== i))} aria-label={`Remove ${s}`}>
              ✕
            </Button>
          </div>
        ))}
        <div className="f-row">
          <TextInput
            aria-label="Add a subtask"
            placeholder="+ Add a subtask"
            value={next}
            onChange={(e) => setNext(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSub())}
          />
          <Button variant="default" onClick={addSub} disabled={!next.trim()}>
            Add subtask
          </Button>
        </div>
        <div className="m-meta">Every subtask must be ticked before the chore goes to you for approval.</div>
      </div>
      <Checkbox label="Needs a photo" checked={photo} onChange={(e) => setPhoto(e.currentTarget.checked)} />
      <div className="f-row">
        <Button onClick={save} disabled={!ready} loading={create.isPending || patch.isPending}>
          Save
        </Button>
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

interface Props extends Omit<FormProps, 'onCopy'> {
  opened: boolean
  onCopy: (c: ChoreDefinition) => void
}

/** Side panel (full screen on phones) to create, edit or copy a chore. */
export function ChoreEditor({ opened, onCopy, ...form }: Props) {
  const small = useMediaQuery('(max-width: 767px)')
  const heading = form.chore && !form.copy ? 'Edit chore' : 'New chore'
  return (
    <Drawer opened={opened} onClose={form.onClose} position="right" size={small ? '100%' : 'md'} title={heading}>
      <ChoreForm key={`${form.chore?.id}-${form.copy}`} {...form} onCopy={() => form.chore && onCopy(form.chore)} />
    </Drawer>
  )
}
