import { Fragment, useState } from 'react'
import { Icon } from '@/v2/parent/Icon'
import { wallTime } from './choreMeta'

export const MAX_STEPS = 20 // backend limit
export interface Step {
  title: string
  due_time: string | null
  after_previous: boolean
}

interface Props {
  steps: Step[]
  onChange: (steps: Step[]) => void
  /** Text typed in "Add a step", kept by the editor so it counts as unsaved. */
  next: string
  onNext: (next: string) => void
  /** Latest due time of the chore's assignments ("HH:MM"), or null. */
  choreDue: string | null
}

const hhmm = (t: string) => t.slice(0, 5)
const moved = <T,>(list: T[], from: number, to: number) => {
  const s = [...list]
  s.splice(to, 0, ...s.splice(from, 1))
  return s
}

/** Steps card: drag or ↑/↓ to reorder, a due time per step, and links that chain a step to the one above. */
export function ChoreSteps({ steps, onChange, next, onNext, choreDue }: Props) {
  const [editing, setEditing] = useState<number | null>(null)
  const full = steps.length >= MAX_STEPS
  const set = (i: number, patch: Partial<Step>) => onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const add = () => {
    if (next.trim() && !full) onChange([...steps, { title: next.trim(), due_time: null, after_previous: false }])
    onNext('')
  }
  // a step is numbered when it is chained to a neighbour; free steps show a dashed "–"
  const chained = (i: number) => (i > 0 && steps[i].after_previous) || !!steps[i + 1]?.after_previous

  // pointer drag on the handle: the row under the pointer takes the dragged step's place
  const drag = (from: number) => {
    let at = from
    let list = steps
    const onMove = (e: PointerEvent) => {
      const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-step]')
      const to = row ? Number(row.dataset.step) : at
      if (to === at) return
      list = moved(list, at, to)
      at = to
      onChange(list)
    }
    const stop = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  const due = steps.map((s) => s.due_time && hhmm(s.due_time)).filter((t): t is string => !!t)
  const latest = due.length ? due.reduce((a, b) => (b > a ? b : a)) : null
  const late = choreDue ? steps.filter((s) => s.due_time && hhmm(s.due_time) > hhmm(choreDue)) : []

  return (
    <section className="pk-panel" aria-label="Steps">
      <h3>
        <Icon name="checklist" size={18} />
        Steps
      </h3>
      <div className="pk-steps">
        {steps.map((s, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <button type="button" className="pk-link" aria-pressed={s.after_previous} onClick={() => set(i, { after_previous: !s.after_previous })}>
                <Icon name={s.after_previous ? 'link' : 'link_off'} size={14} />
                {s.after_previous ? 'Must be done after the step above' : 'Any order'}
              </button>
            )}
            <div className="pk-step" data-step={i}>
              <span className="pk-grab" aria-hidden onPointerDown={(e) => (e.preventDefault(), drag(i))} title="Drag to reorder">
                <Icon name="drag_indicator" size={18} />
              </span>
              <span className="pk-num" data-free={!chained(i)}>
                {chained(i) ? i + 1 : '–'}
              </span>
              <input
                className="pk-step-t"
                aria-label={`Step ${i + 1} name`}
                value={s.title}
                maxLength={100}
                onChange={(e) => set(i, { title: e.currentTarget.value })}
              />
              {editing === i ? (
                <input
                  type="time"
                  className="pk-due"
                  aria-label={`Due time for ${s.title}`}
                  autoFocus
                  value={s.due_time ? hhmm(s.due_time) : ''}
                  onChange={(e) => set(i, { due_time: e.currentTarget.value || null })}
                  onBlur={() => setEditing(null)}
                />
              ) : (
                <button type="button" className="pk-due" data-none={!s.due_time} aria-label={`${s.due_time ? `by ${wallTime(s.due_time)}` : 'Due time'}, due time for ${s.title}`} onClick={() => setEditing(i)}>
                  <Icon name="schedule" size={14} />
                  {s.due_time ? `by ${wallTime(s.due_time)}` : 'Due time'}
                </button>
              )}
              <button type="button" className="pk-ib pk-move" disabled={i === 0} onClick={() => onChange(moved(steps, i, i - 1))} aria-label={`Move up ${s.title}`} title="Move up">
                <Icon name="arrow_upward" size={16} />
              </button>
              <button type="button" className="pk-ib pk-move" disabled={i === steps.length - 1} onClick={() => onChange(moved(steps, i, i + 1))} aria-label={`Move down ${s.title}`} title="Move down">
                <Icon name="arrow_downward" size={16} />
              </button>
              <button type="button" className="pk-ib" onClick={() => onChange(steps.filter((_, j) => j !== i))} aria-label={`Remove ${s.title}`} title="Remove step">
                <Icon name="close" size={16} />
              </button>
            </div>
          </Fragment>
        ))}
      </div>
      <label className="pk-add" data-disabled={full}>
        <Icon name="add" size={18} />
        <input
          aria-label="Add a step"
          placeholder={full ? `${MAX_STEPS} steps is the most` : 'Add a step'}
          value={next}
          maxLength={100}
          disabled={full}
          enterKeyHint="done"
          onChange={(e) => onNext(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        />
      </label>
      {steps.length > 1 && (
        <div className="pk-legend">
          <span>
            <Icon name="link" size={14} /> tap between steps to chain them
          </span>
          <span>
            <span className="pk-num">1</span> must go in order
          </span>
          <span>
            <span className="pk-num" data-free="true">–</span> any time
          </span>
        </div>
      )}
      {late.map((s, i) => (
        <div key={`${i}-${s.title}`} className="pk-warn" role="note">
          <Icon name="info" size={15} />
          {`“${s.title}” is due after the chore (${wallTime(choreDue!)}). The chore will stay open until ${wallTime(latest!)}.`}
        </div>
      ))}
      <span className="pk-hint">
        Every step must be ticked before the chore goes to you for approval. {steps.length} of {MAX_STEPS} steps.
      </span>
    </section>
  )
}
