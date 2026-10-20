import type { ReactNode } from 'react'
import { Button, Group } from '@mantine/core'
import { StickerCard } from '../components/StickerCard'

export const STEP_TITLES = ['Your family', 'Your account', 'Add kids', 'Devices', 'Chores', 'Bedtime', 'Remote access']

interface Props {
  step: number // 1-based
  children: ReactNode
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  onSkip?: () => void
  busy?: boolean
}

/** Numbered sticker progress + card + Back / Skip / Next row. */
export function WizardFrame({ step, children, onBack, onNext, nextLabel = 'Next', onSkip, busy }: Props) {
  return (
    <main className="f-main" style={{ maxWidth: 640 }}>
      <ol aria-label="Setup steps" className="f-row" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {STEP_TITLES.map((t, i) => (
          <li key={t} aria-current={i + 1 === step ? 'step' : undefined} aria-label={`Step ${i + 1}, ${t}`}>
            <span className="f-sticker" style={{ opacity: i + 1 === step ? 1 : 0.55 }}>{i + 1}</span>
          </li>
        ))}
      </ol>
      <StickerCard>
        <h1 className="f-display" style={{ marginTop: 0 }}>{STEP_TITLES[step - 1]}</h1>
        {children}
        <Group mt="lg" justify="space-between" wrap="wrap">
          {onBack ? <Button variant="default" onClick={onBack}>Back</Button> : <span />}
          <Group>
            {onSkip && <Button variant="subtle" onClick={onSkip}>Skip</Button>}
            <Button onClick={onNext} loading={busy}>{nextLabel}</Button>
          </Group>
        </Group>
      </StickerCard>
    </main>
  )
}
