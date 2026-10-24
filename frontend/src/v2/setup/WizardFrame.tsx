import type { ReactNode } from 'react'
import { useState, useEffect } from 'react'
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

  const estimatedMinLeft = Math.max(1, 8 - step)

  return (
    <main className={styles.wizard} data-look="parent">
      {/* Left panel */}
      <aside className={styles.side}>
        <div className={styles.wm}>
          <i>@</i>
          <span>t@sk4ce setup</span>
        </div>
        <div className={styles.steps}>
          {STEPS.map((s, i) => {
            const isDone = i + 1 < step
            const isActive = i + 1 === step
            const canOpen = i + 1 <= maxStepReached
            return (
              <div
                key={s.num}
                className={`${styles.st} ${isDone ? styles.done : ''} ${isActive ? styles.on : ''}`}
                onClick={() => canOpen && onStepClick?.(i + 1)}
                role={canOpen ? 'button' : undefined}
                tabIndex={canOpen ? 0 : -1}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Step ${s.num}, ${s.title}`}
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
          Step {step} of {STEPS.length} · about {estimatedMinLeft} min left
          <div className={styles.pb}>
            <i style={{ width: `${(step / STEPS.length) * 100}%` }} />
          </div>
        </div>
      </aside>

      {/* Right panel */}
      <div className={styles.main}>
        {title && (
          <>
            {step <= STEPS.length && <div className={styles.eyebrow}>Step {step} of {STEPS.length}{step === 7 ? ' · optional' : ''}</div>}
            <h2>{title}</h2>
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
          <Group>
            {onSkip && (
              <Button variant="subtle" onClick={onSkip}>
                Skip
              </Button>
            )}
            <Button onClick={onNext} loading={busy} leftSection={nextLabel === 'Finish' ? <span className="ms" aria-hidden="true">check</span> : <span className="ms" aria-hidden="true">arrow_forward</span>}>
              {nextLabel}
            </Button>
          </Group>
        </Group>
      </div>
    </main>
  )
}
