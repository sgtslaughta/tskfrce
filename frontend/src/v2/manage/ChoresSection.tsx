import { useState } from 'react'
import { Button, Chip } from '@mantine/core'
import type { ChoreDefinition } from '@/v2/hooks/useChores'
import type { Kid } from '@/v2/types'
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

export interface KidProgress {
  id: number
  name: string
  done: number
  total: number
}

interface Props {
  kids: Kid[]
  chores: ChoreDefinition[]
  progress: KidProgress[]
  initialKid?: string
}

/** Filterable chore list (kid chips show today's progress) and the editor drawer. */
export function ChoresSection({ kids, chores, progress, initialKid }: Props) {
  const [filter, setFilter] = useState(initialKid ?? 'all')
  const [open, setOpen] = useState<{ chore?: ChoreDefinition; copy?: boolean } | null>(null)
  const shown = chores.filter((c) =>
    filter === 'all' ? true : filter === 'shared' ? c.kid_ids.length > 1 : c.kid_ids.includes(Number(filter)),
  )
  const byId = new Map(kids.map((k) => [k.id, k]))
  const prog = new Map(progress.map((p) => [p.id, p]))

  return (
    <>
      <div className="f-title-row">
        <h2 className="f-display">Chores</h2>
        <Button onClick={() => setOpen({})}>New chore</Button>
      </div>
      <Chip.Group value={filter} onChange={(v) => setFilter(String(v))}>
        <div className="f-row">
          <Chip value="all">Everyone</Chip>
          {kids.map((k) => (
            <Chip key={k.id} value={String(k.id)}>
              {nameOf(k)}{' '}
              <span className="m-num">
                {prog.get(k.id)?.done ?? 0}/{prog.get(k.id)?.total ?? 0}
              </span>
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
              {c.kid_ids.map((id) => {
                const k = byId.get(id)
                const name = k ? nameOf(k) : 'Unknown kid'
                return (
                  <span key={id} className="m-av" title={name} aria-label={name} role="img">
                    {k?.avatar || name[0]}
                  </span>
                )
              })}
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
