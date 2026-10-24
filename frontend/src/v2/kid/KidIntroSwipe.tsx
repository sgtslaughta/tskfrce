import { useState } from 'react'
import { Button } from '@mantine/core'
import { useTips } from '../hooks/useTips'
import { StickerCard } from '../components/StickerCard'
import { Icon } from '../parent/Icon'

interface Props {
  onComplete: () => void
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

const ageGroup: AgeGroup = 'kid' // default; will be populated from data in integration

export function KidIntroSwipe({ onComplete }: Props) {
  const { isDismissed, dismiss } = useTips()
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        minHeight: 400,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          flex: 1,
        }}
      >
        <div
          style={{
            fontSize: 64,
            marginTop: 'auto',
          }}
        >
          <Icon name={cards[step].icon} size={64} />
        </div>
        <div>
          <h2 style={{ margin: '0 0 8px', fontSize: 24 }}>
            {cards[step].title}
          </h2>
          <p style={{ margin: 0, fontSize: 16, color: 'var(--f-sub)' }}>
            {cards[step].desc}
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 4,
          justifyContent: 'center',
          margin: '16px 0',
        }}
      >
        {cards.map((_, i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: i === step ? 'var(--f-acc)' : 'var(--f-line)',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 'auto' }}>
        <Button
          variant="default"
          size="md"
          onClick={handleSkip}
          style={{ flex: 1 }}
        >
          Skip
        </Button>
        <Button
          size="md"
          onClick={handleNext}
          style={{ flex: 1 }}
        >
          {step === cards.length - 1 ? 'Done' : 'Next'}
        </Button>
      </div>
    </div>
  )
}
