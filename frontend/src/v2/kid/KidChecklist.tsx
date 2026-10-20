import { Button } from '@mantine/core'
import { ChoreChip } from '../components/ChoreChip'
import type { TodayChore } from '../types'

/** Chore rows for the locked screen. `onDone` omitted = read-only. */
export function KidChecklist({
  chores,
  onDone,
  busyId,
}: {
  chores: TodayChore[]
  onDone?: (id: number) => void
  busyId?: number | null
}) {
  if (!chores.length) return <p style={{ margin: 0, fontSize: 18 }}>No chores today.</p>
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
      {chores.map((c) => (
        <li
          key={c.id}
          style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minHeight: 56 }}
        >
          <ChoreChip state={c.state} />
          <span className="f-display" style={{ flex: '1 1 140px', fontSize: 22, fontWeight: 600 }}>
            {c.title}
          </span>
          <span style={{ fontWeight: 800, color: 'var(--f-sub)' }}>+{c.points}</span>
          {c.state === 'todo' && onDone && (
            <Button size="lg" loading={busyId === c.id} onClick={() => onDone(c.id)}>
              Mark done
            </Button>
          )}
          {c.state === 'needs_you' && <span style={{ fontWeight: 700 }}>Waiting for Mom or Dad</span>}
          {c.state === 'done' && <span style={{ fontWeight: 700 }}>Done</span>}
        </li>
      ))}
    </ul>
  )
}
