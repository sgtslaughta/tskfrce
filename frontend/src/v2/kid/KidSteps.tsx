import { Checkbox } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'
import { useTickSubtask } from '../hooks/useKid'
import { useClock } from '../today/useClock'
import type { KidChore } from '../types'

/** Checklist of a chore's steps; a chained step stays locked until the one before it is done. */
export function KidSteps({ c }: { c: KidChore }) {
  const tick = useTickSubtask()
  const wall = useClock()
  const steps = c.subtasks!
  const now = Date.now()
  return (
    <div style={{ flexBasis: '100%', display: 'grid', gap: 6, paddingLeft: 8 }}>
      {steps.map((s, i) => {
        const late = !s.done && !!s.due_at && Date.parse(s.due_at) < now
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', opacity: s.locked ? 0.55 : 1 }}>
            <Checkbox
              size="md"
              label={s.title}
              checked={s.done}
              disabled={!!s.locked}
              onChange={(e) => tick.mutate({ chore: c.id, sub: s.id, done: e.currentTarget.checked })}
              styles={{ root: { minHeight: 44, display: 'flex', alignItems: 'center' } }}
            />
            {s.locked && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: 'var(--f-sub)' }}>
                <IconLock size={16} aria-hidden />
                {`Unlocks after step ${steps.findIndex((p, j) => j < i && !p.done) + 1 || i}`}
              </span>
            )}
            {s.due_at && !s.done && (
              <span className="f-pill" data-tone={late ? 'late' : 'mute'}>
                {late ? 'Late' : `by ${wall(s.due_at)}`}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
