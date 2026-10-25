import { useState } from 'react'
import { Button } from '@mantine/core'
import { useTipState } from '../hooks/useTips'
import { StickerCard } from '../components/StickerCard'
import { Icon } from '../parent/Icon'

interface Props {
  onComplete: () => void
}

// ponytail: one wording for every age; age-group copy arrives with the age setting (Plan D)
const CARDS = [
  { icon: 'task_alt', title: 'Do your chores', desc: 'Finish the chores your family gives you.' },
  { icon: 'redeem', title: 'Ask for rewards', desc: 'Earn points and trade them for cool things.' },
  { icon: 'mail', title: 'Tell a parent', desc: 'Stuck? Send a note and they will help.' },
]

export function KidIntroSwipe({ onComplete }: Props) {
  const { ready, isDismissed, dismiss } = useTipState(true)
  const [step, setStep] = useState(0)

  if (!ready || isDismissed('onboard.kid')) return null
  const cards = CARDS

  const handleNext = () => {
    if (step < cards.length - 1) {
      setStep(step + 1)
    } else {
      dismiss('onboard.kid')
      onComplete()
    }
  }

  const handleSkip = () => {
    dismiss('onboard.kid')
    onComplete()
  }

  return (
    <StickerCard>
      <div className="f-intro-container" data-testid="kid-intro-swipe">
        <div className="f-intro-content">
          <div className="f-intro-icon" key={`icon-${step}`}>
            <Icon name={cards[step].icon} size={64} />
          </div>
          <div className="f-intro-text">
            <h2 className="f-intro-title" key={`title-${step}`}>
              {cards[step].title}
            </h2>
            <p className="f-intro-desc" key={`desc-${step}`}>
              {cards[step].desc}
            </p>
          </div>
        </div>

        <div className="f-intro-dots">
          {cards.map((_, i) => (
            <button
              key={i}
              className="f-intro-dot"
              data-active={i === step}
              onClick={() => setStep(i)}
              aria-label={`Go to slide ${i + 1}`}
              type="button"
            />
          ))}
        </div>

        <div className="f-intro-buttons">
          <Button
            variant="default"
            size="md"
            onClick={handleSkip}
            fullWidth
          >
            Skip
          </Button>
          <Button
            size="md"
            onClick={handleNext}
            fullWidth
          >
            {step === cards.length - 1 ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </StickerCard>
  )
}
