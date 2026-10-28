import { FocusTrap } from '@mantine/core'
import { useState } from 'react'
import { useTipState } from '../hooks/useTips'
import { focusPage } from './focusPage'
import { Icon } from '../parent/Icon'

interface Props {
  onComplete: () => void
  kidId?: number | null
}

const TIP = 'onboard.kid'
// ponytail: one wording for every age; age-group copy arrives with the age setting (Plan D)
const CARDS = [
  { icon: 'task_alt', title: 'Do your chores', desc: 'Finish the chores your family gives you.' },
  { icon: 'redeem', title: 'Ask for rewards', desc: 'Earn points and trade them for cool things.' },
  { icon: 'mail', title: 'Tell a parent', desc: 'Stuck? Send a note and they will help.' },
]

// the box remembers the dismissal per kid; this browser flag backs it up if that save fails
const flag = (kidId?: number | null) => `tskfrce.intro.${kidId ?? 'kid'}`
const seenHere = (kidId?: number | null) => {
  try {
    return localStorage.getItem(flag(kidId)) === '1'
  } catch {
    return false
  }
}
const markSeen = (kidId?: number | null) => {
  try {
    localStorage.setItem(flag(kidId), '1')
  } catch {
    /* private mode: the box copy still counts */
  }
}

/** First-visit intro: a once-only sheet over the kid app (not part of the chore list). Styles: kid-intro.css. */
export function KidIntroSwipe({ onComplete, kidId }: Props) {
  const { ready, isDismissed, dismiss } = useTipState(true)
  const [step, setStep] = useState(0)

  if (!ready || isDismissed(TIP) || seenHere(kidId)) return null
  const last = step === CARDS.length - 1
  const card = CARDS[step]

  const finish = () => {
    markSeen(kidId)
    dismiss(TIP)
    onComplete()
    setTimeout(() => focusPage('main h1', '.r-head', 'main')) // after the focus trap lets go
  }

  return (
    <div className="k-intro-back k-tok">
      <FocusTrap active>
        <div className="k-intro" role="dialog" aria-modal="true" aria-labelledby="k-intro-t" data-testid="kid-intro-swipe" onKeyDown={(e) => e.key === 'Escape' && finish()}>
          <span className="k-intro-ic" aria-hidden key={`i${step}`}>
            <Icon name={card.icon} size={56} />
          </span>
          <h2 id="k-intro-t" className="k-intro-t k-disp" key={`t${step}`}>
            {card.title}
          </h2>
          <p className="k-intro-d" key={`d${step}`}>
            {card.desc}
          </p>
          <div className="k-intro-dots">
            {CARDS.map((_, i) => (
              <button key={i} type="button" className="k-intro-dot" data-active={i === step} onClick={() => setStep(i)} aria-label={`Go to slide ${i + 1}`} />
            ))}
          </div>
          <div className="k-intro-btns">
            <button type="button" className="r-btn" data-tone="plain" onClick={finish}>
              Skip
            </button>
            <button type="button" className="r-btn" data-autofocus onClick={() => (last ? finish() : setStep(step + 1))}>
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  )
}
