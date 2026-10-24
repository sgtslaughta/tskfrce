import { useState } from 'react'
import { Button } from '@mantine/core'
import { useTipsLocal } from '../hooks/useTips'
import { StickerCard } from '../components/StickerCard'
import { Icon } from '../parent/Icon'

interface Props {
  onComplete: () => void
  ageGroup?: 'little' | 'kid' | 'teen'
}

type AgeGroup = 'little' | 'kid' | 'teen'

const wordsMap: Record<AgeGroup, Record<string, string>> = {
  little: {
    title1: 'Do Your Chores',
    desc1: 'Complete the chores your family gives you',
    title2: 'Ask for Rewards',
    desc2: 'Earn points and get cool things',
    title3: 'Tell Mom or Dad',
    desc3: 'Let them know if you need help',
  },
  kid: {
    title1: 'Do Your Chores',
    desc1: 'Complete the chores your family gives you',
    title2: 'Ask for Rewards',
    desc2: 'Earn points and get cool things',
    title3: 'Tell Mom or Dad',
    desc3: 'Let them know if you need help',
  },
  teen: {
    title1: 'Do Your Chores',
    desc1: 'Complete the chores your family gives you',
    title2: 'Ask for Rewards',
    desc2: 'Earn points and get cool things',
    title3: 'Tell Mom or Dad',
    desc3: 'Let them know if you need help',
  },
}

export function KidIntroSwipe({ onComplete, ageGroup = 'kid' }: Props) {
  const { isDismissed, dismiss } = useTipsLocal()
  const [step, setStep] = useState(0)

  if (isDismissed('onboard.kid')) return null

  const cards = [
    {
      icon: 'task_alt',
      title: wordsMap[ageGroup].title1,
      desc: wordsMap[ageGroup].desc1,
    },
    {
      icon: 'redeem',
      title: wordsMap[ageGroup].title2,
      desc: wordsMap[ageGroup].desc2,
    },
    {
      icon: 'mail',
      title: wordsMap[ageGroup].title3,
      desc: wordsMap[ageGroup].desc3,
    },
  ]

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
