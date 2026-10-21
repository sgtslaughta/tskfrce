import { useState } from 'react'
import { Button, Chip } from '@mantine/core'
import type { ChoreDefinition } from '@/v2/hooks/useChores'
import type { Kid } from '@/v2/types'
import type { KidProgress } from './ManageLayout'
import { ChoreEditor } from './ChoreEditor'

const nameOf = (k: Kid) => k.full_name ?? k.username
const REPEAT_DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function meta(c: ChoreDefinition) {
  const r = c.repeat
  const when =
    r.type === 'daily' ? 'Daily' : r.type === 'once' ? 'Once' : r.days.map((d) => REPEAT_DAY[d]).join(', ')
  const bits = [when]
  if (c.due_time) bits.push(`due ${c.due_time}`)
  if (c.subtasks.length) bits.push(`${c.subtasks.length} subtasks`)
  return bits.join(' · ')
}

interface Props {
  kids: Kid[]
  chores: ChoreDefinition[]
  progress: KidProgress[]
  initialKid?: string
}

/** Progress strip per kid, filterable chore list, and the editor drawer. */
export function ChoresSection({ kids, chores, progress, initialKid }: Props) {
  const [filter, setFilter] = useState(initialKid ?? 'all')
  const [open, setOpen] = useState<{ chore?: ChoreDefinition; copy?: boolean } | null>(null)
  const shown = chores.filter((c) =>
    filter === 'all' ? true : filter === 'shared' ? c.kid_ids.length > 1 : c.kid_ids.includes(Number(filter)),
  )
  const byId = new Map(kids.map((k) => [k.id, k]))

  return (
    <>
      <div className="m-strip">
        {progress.map((p) => (
          <div key={p.id} className="f-card">
            <div className="f-row" style={{ justifyContent: 'space-between' }}>
              <b className="f-display">{p.name}</b>
              <span className="m-num">
                {p.done}/{p.total}
              </span>
            </div>
            <div className="m-bar">
              <i style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
            </div>
            <div className="m-meta">{p.total === p.done ? 'All done' : `${p.total - p.done} left`}</div>
          </div>
        ))}
      </div>
      <div className="f-title-row">
        <h2 className="f-display">Chores</h2>
        <Button onClick={() => setOpen({})}>New chore</Button>
      </div>
      <Chip.Group value={filter} onChange={(v) => setFilter(String(v))}>
        <div className="f-row">
          <Chip value="all">Everyone</Chip>
          {kids.map((k) => (
            <Chip key={k.id} value={String(k.id)}>
              {nameOf(k)}
            </Chip>
          ))}
          <Chip value="shared">Shared</Chip>
        </div>
      </Chip.Group>
      {shown.length === 0 && <p>No chores here yet. Add one with New chore.</p>}
      <div className="f-card m-list">
        {shown.map((c) => (
          <button key={c.id} type="button" className="m-row" onClick={() => setOpen({ chore: c })}>
            <span>
              <b>{c.title}</b>
              <span className="m-meta">{meta(c)}</span>
            </span>
            <span className="m-avs">
              {c.kid_ids.map((id) => (
                <span key={id} className="m-av">
                  {(byId.get(id) ? nameOf(byId.get(id) as Kid) : '?')[0]}
                </span>
              ))}
            </span>
            <span className="m-mode" data-mode={c.kid_ids.length > 1 ? c.mode : 'solo'}>
              {c.kid_ids.length > 1 ? c.mode : 'Solo'}
            </span>
            <span className="m-num">+{c.points}</span>
          </button>
        ))}
      </div>
      <ChoreEditor
        opened={open !== null}
        kids={kids}
        chore={open?.chore}
        copy={open?.copy}
        onCopy={(chore) => setOpen({ chore, copy: true })}
        onClose={() => setOpen(null)}
      />
    </>
  )
}
