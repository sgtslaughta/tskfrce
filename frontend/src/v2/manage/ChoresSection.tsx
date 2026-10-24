import { useState } from 'react'
import { Button, Chip } from '@mantine/core'
import type { Kid, LibChore } from '@/v2/types'
import { ChoreEditor } from './ChoreEditor'

const nameOf = (k: Kid) => k.full_name ?? k.username

const usedBy = (c: LibChore) => Array.from(new Set(c.assignments.filter((a) => a.active).flatMap((a) => a.kid_ids)))

function meta(c: LibChore) {
  const bits = c.steps.length ? [`${c.steps.length} ${c.steps.length === 1 ? 'step' : 'steps'}`] : []
  if (c.needs_photo) bits.push('photo')
  return bits.join(' · ') || 'No steps'
}

export interface KidProgress {
  id: number
  name: string
  done: number
  total: number
}

interface Props {
  kids: Kid[]
  chores: LibChore[]
  progress: KidProgress[]
  initialKid?: string
}

/** Filterable chore list (kid chips show today's progress) and the editor drawer. */
export function ChoresSection({ kids, chores, progress, initialKid }: Props) {
  const [filter, setFilter] = useState(initialKid ?? 'all')
  const [open, setOpen] = useState<{ id?: number } | null>(null)
  const shown = chores.filter((c) =>
    filter === 'all'
      ? true
      : filter === 'shared'
        ? c.assignments.some((a) => a.active && a.kid_ids.length > 1)
        : c.assignments.some((a) => a.active && a.kid_ids.includes(Number(filter))),
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
          <button key={c.id} type="button" className="m-row" onClick={() => setOpen({ id: c.id })}>
            <span>
              <b>{c.title}</b>
              <span className="m-meta">{meta(c)}</span>
            </span>
            <span className="m-avs">
              {usedBy(c).map((id) => {
                const k = byId.get(id)
                const name = k ? nameOf(k) : 'Unknown kid'
                return (
                  <span key={id} className="m-av" title={name} aria-label={name} role="img">
                    {k?.avatar || name[0]}
                  </span>
                )
              })}
            </span>
            <span className="m-num">+{c.points}</span>
          </button>
        ))}
      </div>
      <ChoreEditor
        opened={open !== null}
        kids={kids}
        chore={chores.find((c) => c.id === open?.id)}
        onOpen={(id) => setOpen({ id })}
        onClose={() => setOpen(null)}
      />
    </>
  )
}
