import type { ReactNode } from 'react'
import { Button, Group } from '@mantine/core'
import { AuthBrand } from '../components/AuthBrand'
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
    <main className="f-main f-auth" style={{ maxWidth: 640 }}>
      <AuthBrand />
      <ol aria-label="Setup steps" className="w-steps">
        {STEP_TITLES.map((t, i) => (
          <li key={t} aria-current={i + 1 === step ? 'step' : undefined} aria-label={`Step ${i + 1}, ${t}`}>
            <span className="w-bar" data-done={i + 1 <= step ? '' : undefined} />
          </li>
        ))}
      </ol>
      <p className="f-cap w-count">{`Step ${step} of ${STEP_TITLES.length}`}</p>
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
