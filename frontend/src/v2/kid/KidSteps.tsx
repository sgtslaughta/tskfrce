import { Icon } from '@/v2/parent/Icon'
import { useTickSubtask } from '../hooks/useKid'
import type { KidChore } from '../types'
import { nextStep, stepBadge, stepChip, stepHint } from './kidChips'

/** A chore's steps. big = Kid/Little (48px boxes), small = Teen (20px boxes + time chip). */
export function KidSteps({
  c,
  timezone,
  size = 'big',
  readOnly = false,
}: {
  c: KidChore
  timezone?: string
  size?: 'big' | 'small'
  readOnly?: boolean
}) {
  const tick = useTickSubtask()
  const steps = c.subtasks ?? []
  const next = nextStep(steps)
  const now = Date.now()
  return (
    <div className="k-steps" data-size={size}>
      {steps.map((s, i) => {
        const state = s.done ? 'done' : s.locked ? 'locked' : i === next ? 'next' : 'open'
        const badge = stepBadge(steps, i)
        const due = stepChip(s, now, timezone)
        // big steps say the time in words; only a missed one adds the Late chip (§2.6)
        const chip = size === 'small' || due?.tone === 'late' ? due : null
        const hint = stepHint(steps, i, timezone)
        return (
          <div key={s.id} className="k-step" data-state={state}>
            <span className="k-num" data-free={badge === '–' || undefined} aria-hidden>
              {badge}
            </span>
            <span className="k-cb">
              <input
                type="checkbox"
                aria-label={s.title}
                checked={s.done}
                disabled={readOnly || !!s.locked}
                onChange={(e) => tick.mutate({ chore: c.id, sub: s.id, done: e.currentTarget.checked })}
              />
              {s.done && <Icon name="check" />}
              {!s.done && s.locked && <Icon name="lock" />}
            </span>
            <span className="k-sx">
              <span>{s.title}</span>
              {hint && <small>{hint}</small>}
            </span>
            {chip && (
              <span className="k-chip" data-tone={chip.tone} data-size="sm">
                {chip.tone === 'late' && <Icon name="alarm" />}
                {size === 'big' ? `Late · ${chip.time}` : chip.time}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
