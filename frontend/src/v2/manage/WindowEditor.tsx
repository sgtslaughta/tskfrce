import { useState } from 'react'
import { ActionIcon, Button, Chip, Text, TextInput } from '@mantine/core'
import { useAddWindow, useDeleteWindow, useWindows } from '@/v2/hooks/useWindows'
import { DAYS } from '@/v2/days'
import type { TimeWindow } from '@/v2/types'
import { toastFail, toastOk } from './notify'

type Kind = TimeWindow['kind']
const KINDS: { kind: Kind; title: string; add: string }[] = [
  { kind: 'allowed', title: 'Allowed hours', add: 'Add allowed hours' },
  { kind: 'free', title: 'Free time', add: 'Add free time' },
]

const describe = (w: TimeWindow) =>
  `${w.days.split('').map((d) => DAYS[Number(d)]).join(' ')} ${w.start}-${w.end}`

interface Props {
  target: { kid_id: number } | { group_id: number }
  label: string
}

export function WindowEditor({ target, label }: Props) {
  const windows = useWindows()
  const add = useAddWindow()
  const del = useDeleteWindow()
  const [adding, setAdding] = useState<Kind | null>(null)
  const [days, setDays] = useState(['0', '1', '2', '3', '4', '5', '6'])
  const [start, setStart] = useState('15:00')
  const [end, setEnd] = useState('19:00')

  const mine = (windows.data ?? []).filter((w) =>
    'kid_id' in target ? w.kid_id === target.kid_id : w.group_id === target.group_id,
  )
  const overnight = end < start
  const same = start === end && start !== ''

  const save = () =>
    adding &&
    add.mutate(
      { kind: adding, days: days.slice().sort().join(''), start, end, ...target },
      {
        onError: toastFail,
        onSuccess: () => {
          toastOk('Added')
          setAdding(null)
        },
      },
    )

  return (
    <section aria-label={`${label} hours`}>
      <h3 className="f-display">{label}</h3>
      {KINDS.map(({ kind, title, add: addLabel }) => (
        <div key={kind}>
          <Text fw={700}>{title}</Text>
          {mine
            .filter((w) => w.kind === kind)
            .map((w) => (
              <div key={w.id} className="f-row">
                <Text>{describe(w)}</Text>
                <ActionIcon
                  variant="subtle"
                  color="fridgeRed"
                  size={44}
                  aria-label={`Remove ${title.toLowerCase()} ${describe(w)}`}
                  onClick={() => del.mutate(w.id, { onError: toastFail, onSuccess: () => toastOk('Removed') })}
                >
                  ✕
                </ActionIcon>
              </div>
            ))}
          {adding !== kind && (
            <Button variant="default" onClick={() => setAdding(kind)}>
              {addLabel}
            </Button>
          )}
        </div>
      ))}
      {adding && (
        <div className="f-card">
          <Chip.Group multiple value={days} onChange={setDays}>
            <div className="f-row">
              {DAYS.map((d, i) => (
                <Chip key={d} value={String(i)}>
                  {d}
                </Chip>
              ))}
            </div>
          </Chip.Group>
          <TextInput type="time" label="Start" value={start} onChange={(e) => setStart(e.currentTarget.value)} />
          <TextInput type="time" label="End" value={end} onChange={(e) => setEnd(e.currentTarget.value)} />
          <div aria-live="polite">
            {overnight && <Text size="sm">Ends the next morning</Text>}
            {same && <Text size="sm">Start and end can't be the same.</Text>}
          </div>
          <Button onClick={save} disabled={!days.length || !start || !end || same} loading={add.isPending}>
            Add
          </Button>
          <Button variant="default" onClick={() => setAdding(null)}>
            Cancel
          </Button>
        </div>
      )}
    </section>
  )
}
