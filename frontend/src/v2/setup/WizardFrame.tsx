import { Icon } from '@/v2/parent/Icon'
import type { ReactNode } from 'react'
import { useState, useEffect, useRef } from 'react'
import { Button, Group } from '@mantine/core'
import { useLook } from '../parent/useLook'
import styles from './wizard.module.css'

const STEPS = [
  { num: 1, title: 'You', sub: 'Parent account' },
  { num: 2, title: 'Family', sub: 'Name, time zone' },
  { num: 3, title: 'Kids', sub: 'Names, PINs' },
  { num: 4, title: 'Chores', sub: 'Pick starters' },
  { num: 5, title: 'Devices', sub: 'Who owns what' },
  { num: 6, title: 'Hours', sub: 'Bedtime, school nights' },
  { num: 7, title: 'Remote access', sub: 'Tailscale', opt: true },
]

export const STEP_TITLES = STEPS.map(s => s.title)

interface Props {
  step: number // 1-based
  children: ReactNode
  title?: string
  subtitle?: string
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  onSkip?: () => void
  onStepClick?: (step: number) => void
  busy?: boolean
}

export function WizardFrame({
  step, children, title, subtitle, onBack, onNext, nextLabel = 'Next', onSkip, onStepClick, busy
}: Props) {
  useLook('parent')
  const [maxStepReached, setMaxStepReached] = useState(step)

  useEffect(() => {
    if (step > maxStepReached) setMaxStepReached(step)
  }, [step, maxStepReached])

  // phone: the step strip scrolls sideways; keep the active step in view
  const stepsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = stepsRef.current?.querySelector<HTMLElement>('[aria-current="step"]')
    const strip = stepsRef.current
    if (el && strip && strip.scrollWidth > strip.clientWidth) strip.scrollLeft = el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2
  }, [step])

  const estimatedMinLeft = Math.max(1, 8 - step)

  return (
    <main className={styles.wizard}>
      {/* Left panel */}
      <aside className={styles.side}>
        <div className={styles.wm}>
          <i>@</i>
          <span>t@sk4ce setup</span>
        </div>
        <div className={styles.steps} ref={stepsRef}>
          {STEPS.map((s, i) => {
            const isDone = i + 1 < step
            const isActive = i + 1 === step
            const canOpen = i + 1 <= Math.min(maxStepReached, step + 1) // the page only goes back or one ahead
            return (
              <div
                key={s.num}
                data-step={s.num}
                className={`${styles.st} ${isDone ? styles.done : ''} ${isActive ? styles.on : ''}`}
                onClick={() => canOpen && onStepClick?.(i + 1)}
                onKeyDown={(e) => {
                  if (canOpen && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onStepClick?.(i + 1)
                  }
                }}
                role={canOpen ? 'button' : undefined}
                tabIndex={canOpen ? 0 : -1}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className={styles.dot}>{isDone ? <span className="ms" aria-hidden="true">check</span> : s.num}</span>
                <div>
                  {s.title}
                  <small>{s.sub}</small>
                </div>
                {s.opt && <span className={styles.opt}>Optional</span>}
              </div>
            )
          })}
        </div>
        <div className={styles.prog}>
          {step > STEPS.length ? 'All steps done' : `Step ${step} of ${STEPS.length} · about ${estimatedMinLeft} min left`}
          <div className={styles.pb}>
            <i style={{ width: `${(Math.min(step, STEPS.length) / STEPS.length) * 100}%` }} />
          </div>
        </div>
      </aside>

      {/* Right panel */}
      <form
        className={styles.main}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (!busy) onNext()
        }}
      >
        {title && (
          <>
            {step <= STEPS.length && <div className={styles.eyebrow}>Step {step} of {STEPS.length}{step === 7 ? ' · optional' : ''}</div>}
            <h1>{title}</h1>
            {subtitle && <div className={styles.s}>{subtitle}</div>}
          </>
        )}
        {children}
        <Group mt="lg" justify="space-between" wrap="wrap" className={styles.nav}>
          {onBack ? (
            <Button variant="subtle" onClick={onBack} leftSection={<span className="ms" aria-hidden="true">arrow_back</span>}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Group ml="auto">
            {onSkip && (
              <Button variant="subtle" onClick={onSkip}>
                Skip
              </Button>
            )}
            <Button type="submit" variant="filled" loading={busy} leftSection={nextLabel === 'Finish' ? <span className="ms" aria-hidden="true">check</span> : <span className="ms" aria-hidden="true">arrow_forward</span>}>
              {nextLabel}
            </Button>
          </Group>
        </Group>
      </form>
    </main>
  )
}
