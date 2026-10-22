import { useState } from 'react'
import { Button, Checkbox, Drawer, NumberInput, TextInput } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { useCopyChore, useDeleteChore, useSaveChore } from '@/v2/hooks/useChores'
import type { Assignment, Kid, LibChore } from '@/v2/types'
import { DAYS } from '@/v2/days'
import { AssignmentForm } from './AssignmentForm'
import { ConfirmDelete } from './ConfirmDelete'
import { toastFail, toastOk } from '../notify'

const nameOf = (k: Kid) => k.full_name ?? k.username

function describe(a: Assignment, kids: Kid[]) {
  const who = a.kid_ids.map((id) => kids.find((k) => k.id === id)).map((k) => (k ? nameOf(k) : 'Unknown kid'))
  const r = a.repeat
  const when =
    r.type === 'daily' ? 'Every day' : r.type === 'once' ? `On ${a.on_date}` : r.days.map((d) => DAYS[d]).join(', ')
  return [who.join(', '), when, a.due_time && `due ${a.due_time}`, a.kid_ids.length > 1 && a.mode]
    .filter(Boolean)
    .join(' · ')
}

interface FormProps {
  kids: Kid[]
  chore?: LibChore
  onOpen: (id: number) => void
  onClose: () => void
}

function ChoreForm({ kids, chore, onOpen, onClose }: FormProps) {
  const save = useSaveChore()
  const del = useDeleteChore()
  const copy = useCopyChore()
  const [confirm, { open, close }] = useDisclosure(false)
  const [assigning, setAssigning] = useState<Assignment | 'new' | null>(null)
  const [title, setTitle] = useState(chore?.title ?? '')
  const [points, setPoints] = useState<number | string>(chore?.points ?? 10)
  const [steps, setSteps] = useState<string[]>(chore?.steps.map((s) => s.title) ?? [])
  const [next, setNext] = useState('')
  const [photo, setPhoto] = useState(chore?.needs_photo ?? false)

  if (chore && assigning)
    return (
      <AssignmentForm
        kids={kids}
        choreId={chore.id}
        assignment={assigning === 'new' ? undefined : assigning}
        onClose={() => setAssigning(null)}
      />
    )

  const addStep = () => {
    if (next.trim()) setSteps([...steps, next.trim()])
    setNext('')
  }
  const move = (i: number, d: number) => {
    const s = [...steps]
    ;[s[i], s[i + d]] = [s[i + d], s[i]]
    setSteps(s)
  }

  const submit = () =>
    save.mutate(
      { id: chore?.id, body: { title: title.trim(), points: Number(points) || 0, needs_photo: photo, steps } },
      {
        onError: toastFail,
        onSuccess: (c) => {
          toastOk(chore ? 'Saved' : 'Added. Now choose who does it.')
          if (chore) onClose()
          else onOpen(c.id)
        },
      },
    )

  const duplicate = () =>
    copy.mutate(chore!.id, {
      onError: toastFail,
      onSuccess: (c) => {
        toastOk('Copied')
        onOpen(c.id)
      },
    })

  return (
    <div className="m-form">
      {chore && (
        <div className="m-actions">
          <Button variant="default" onClick={duplicate} loading={copy.isPending}>
            Copy
          </Button>
          <Button className="m-push" color="fridgeRed" variant="subtle" onClick={open}>
            Delete
          </Button>
          <ConfirmDelete
            opened={confirm}
            title={`Delete ${chore.title}?`}
            body="Chores already done stay in history."
            onConfirm={() => del.mutate(chore.id, { onError: toastFail, onSuccess: onClose })}
            onClose={close}
          />
        </div>
      )}
      <TextInput label="Chore" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
      <NumberInput label="Points" min={0} value={points} onChange={setPoints} />
      <div>
        <div className="f-label">Subtasks</div>
        {steps.map((s, i) => (
          <div key={`${i}-${s}`} className="m-sub">
            <span>{s}</span>
            <Button variant="subtle" size="compact-md" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move up ${s}`}>
              ↑
            </Button>
            <Button variant="subtle" size="compact-md" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label={`Move down ${s}`}>
              ↓
            </Button>
            <Button variant="subtle" size="compact-md" onClick={() => setSteps(steps.filter((_, j) => j !== i))} aria-label={`Remove ${s}`}>
              ✕
            </Button>
          </div>
        ))}
        <div className="f-row">
          <TextInput
            aria-label="Add a step"
            placeholder="Add a step"
            value={next}
            onChange={(e) => setNext(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStep())}
          />
          <Button variant="default" onClick={addStep} disabled={!next.trim()}>
            Add step
          </Button>
        </div>
        <div className="m-meta">Every step must be ticked before the chore goes to you for approval.</div>
      </div>
      <Checkbox label="Needs a photo" checked={photo} onChange={(e) => setPhoto(e.currentTarget.checked)} />
      <div className="f-row">
        <Button onClick={submit} disabled={!title.trim()} loading={save.isPending}>
          Save
        </Button>
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
      </div>
      {chore && (
        <div>
          <div className="f-label">Assignments</div>
          {chore.assignments.length === 0 && <div className="m-meta">Nobody has this chore yet.</div>}
          <div className="f-card m-list">
            {chore.assignments.map((a) => (
              <button key={a.id} type="button" className="m-row" onClick={() => setAssigning(a)}>
                <span>
                  <b>{describe(a, kids)}</b>
                  {!a.active && <span className="m-meta">Stopped</span>}
                </span>
              </button>
            ))}
          </div>
          <Button variant="default" mt="sm" onClick={() => setAssigning('new')}>
            Assign
          </Button>
        </div>
      )}
    </div>
  )
}

interface Props extends FormProps {
  opened: boolean
}

/** Side panel (full screen on phones) to create or edit a library chore and its assignments. */
export function ChoreEditor({ opened, ...form }: Props) {
  const small = useMediaQuery('(max-width: 767px)')
  return (
    <Drawer opened={opened} onClose={form.onClose} position="right" size={small ? '100%' : 'md'} title={form.chore ? 'Edit chore' : 'New chore'}>
      <ChoreForm key={form.chore?.id ?? 'new'} {...form} />
    </Drawer>
  )
}
