import { Button } from '@mantine/core'
import type { Kid, LibChore } from '@/v2/types'

const nameOf = (k: Kid) => k.full_name ?? k.username

const usedBy = (c: LibChore) => Array.from(new Set(c.assignments.filter((a) => a.active).flatMap((a) => a.kid_ids)))

function meta(c: LibChore) {
  const bits = c.steps.length ? [`${c.steps.length} ${c.steps.length === 1 ? 'step' : 'steps'}`] : []
  if (c.needs_photo) bits.push('photo')
  return bits.join(' · ') || 'No steps'
}

interface Props {
  chores: LibChore[]
  kids: Kid[]
  onNew: () => void
  onSelect: (choreId: number) => void
  selectedId?: number
}

export function ChoreList({ chores, kids, onNew, onSelect, selectedId }: Props) {
  const byId = new Map(kids.map((k) => [k.id, k]))

  return (
    <>
      <div className="s-list-header">
        <h2>Chores</h2>
        <Button size="xs" onClick={onNew}>
          New
        </Button>
      </div>
      {chores.length === 0 && <p>No chores yet. Add one with New.</p>}
      <div className="p-list">
        {chores.map((c) => (
          <button
            key={c.id}
            className={`p-list-item ${selectedId === c.id ? 'p-list-selected' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <div className="p-list-content">
              <div className="p-list-title">{c.title}</div>
              <div className="p-list-meta">{meta(c)}</div>
            </div>
            <div className="p-list-badges">
              {usedBy(c).map((id) => {
                const k = byId.get(id)
                const name = k ? nameOf(k) : 'Unknown kid'
                return (
                  <span key={id} className="p-av" title={name} aria-label={name} role="img">
                    {k?.avatar || name[0]}
                  </span>
                )
              })}
            </div>
            <div className="p-list-value">+{c.points}</div>
          </button>
        ))}
      </div>
    </>
  )
}
