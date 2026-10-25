import { useState } from 'react'
import { ActionIcon, Button, Chip, Drawer, Text, TextInput } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useAddWindow, useDeleteWindow, useWindows } from '@/v2/hooks/useWindows'
import { DAYS } from '@/v2/days'
import type { TimeWindow } from '@/v2/types'
import { toastFail, toastOk } from '../notify'

type Kind = TimeWindow['kind']
const KINDS: { kind: Kind; title: string; add: string; empty: string }[] = [
  { kind: 'allowed', title: 'Allowed hours', add: 'Add allowed hours', empty: 'No allowed hours yet. Add when they can be online.' },
  { kind: 'free', title: 'Free time', add: 'Add free time', empty: 'No free time yet. Add times that need no chores.' },
]

const describe = (w: TimeWindow) =>
  `${w.days.split('').map((d) => DAYS[Number(d)]).join(' ')} ${w.start}-${w.end}`

interface Props {
  target: { kid_id: number } | { group_id: number }
  label: string
}

/** Two cards (Allowed hours, Free time) for one kid or group; adding opens a drawer. */
export function WindowEditor({ target, label }: Props) {
  const windows = useWindows()
  const add = useAddWindow()
  const del = useDeleteWindow()
  const small = useMediaQuery('(max-width: 767px)')
  const [adding, setAdding] = useState<Kind | null>(null)
  const [days, setDays] = useState(['0', '1', '2', '3', '4', '5', '6'])
  const [start, setStart] = useState('15:00')
  const [end, setEnd] = useState('19:00')

  const mine = (windows.data ?? []).filter((w) =>
    'kid_id' in target ? w.kid_id === target.kid_id : w.group_id === target.group_id,
  )
  const overnight = end < start
  const same = start === end && start !== ''
  const kindTitle = KINDS.find((k) => k.kind === adding)?.title

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
    <section aria-label={`${label} hours`} className="m-grid2">
      {KINDS.map(({ kind, title, add: addLabel, empty }) => {
        const rows = mine.filter((w) => w.kind === kind)
        return (
          <div key={kind} className="f-card m-list" aria-label={title} role="group">
            <div className="f-title-row" style={{ padding: 16 }}>
              <h3 className="f-display">{title}</h3>
              <Button size="xs" variant="default" aria-label={addLabel} onClick={() => setAdding(kind)}>
                Add
              </Button>
            </div>
            {rows.length === 0 && <p className="m-empty">{empty}</p>}
            {rows.map((w) => (
              <div key={w.id} className="m-rr">
                <div className="m-grow">
                  <div className="m-days">
                    {DAYS.map((d, i) => (
                      <span key={d} className="m-d" data-on={w.days.includes(String(i)) || undefined}>
                        {d}
                      </span>
                    ))}
                  </div>
                  <b className="m-num">
                    {w.start}-{w.end}
                  </b>
                </div>
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
          </div>
        )
      })}
      <Drawer
        opened={adding !== null}
        onClose={() => setAdding(null)}
        position="right"
        size={small ? '100%' : 'md'}
        title={`${kindTitle ?? ''}: ${label}`}
      >
        <form
          className="m-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (days.length && start && end && !same && !add.isPending) save()
          }}
        >
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
            {same && <Text size="sm">Start and end can&apos;t be the same.</Text>}
          </div>
          <div className="m-actions">
            <Button type="submit" disabled={!days.length || !start || !end || same} loading={add.isPending}>
              Add
            </Button>
            <Button variant="default" onClick={() => setAdding(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Drawer>
    </section>
  )
}
