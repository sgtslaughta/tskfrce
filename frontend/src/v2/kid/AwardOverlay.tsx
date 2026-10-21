import { useEffect, useRef } from 'react'
import { Button } from '@mantine/core'
import { useAwards, useMarkAwardSeen } from '../hooks/useKidRewards'
import './award.css'

export function AwardOverlay({ onExpired }: { onExpired: () => void }) {
  const award = useAwards(onExpired).data?.[0]
  const seen = useMarkAwardSeen(onExpired)
  const btn = useRef<HTMLButtonElement>(null)
  const id = award?.id
  const close = () => {
    if (id !== undefined && !seen.isPending) seen.mutate(id)
  }
  useEffect(() => {
    if (id === undefined) return
    btn.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !seen.isPending) seen.mutate(id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  if (!award) return null
  const big = award.kind === 'reward'
  const title = big ? award.name : `${award.minutes} minutes of screen time`
  return (
    <div className="award-back">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="You got a reward"
        className={big ? 'award-card' : 'award-card award-toast'}
      >
        {big && Array.from({ length: 20 }, (_, i) => <span key={i} className="award-confetti" style={{ '--i': i } as React.CSSProperties} />)}
        <p className="f-display" style={{ margin: 0, fontSize: big ? 28 : 20 }}>
          {big ? '🎉 You got it!' : '⏱️ Time added!'}
        </p>
        <strong style={{ fontSize: big ? 32 : 20 }}>{title}</strong>
        <Button ref={btn} size="lg" onClick={close}>
          Nice!
        </Button>
      </div>
    </div>
  )
}
