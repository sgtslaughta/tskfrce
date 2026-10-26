import { useEffect, useRef } from 'react'
import { Button } from '@mantine/core'
import { useCelebrations, useMarkCelebrationSeen } from '../hooks/useKidRewards'
import { Icon } from '../parent/Icon'
import { TIER_COLORS, TIER_NAMES } from '../tiers'

export function AwardOverlay({ onExpired, onLocker }: { onExpired: () => void; onLocker?: () => void }) {
  const award = useCelebrations(onExpired).data?.[0]
  const seen = useMarkCelebrationSeen(onExpired)
  const btn = useRef<HTMLButtonElement>(null)
  const id = award?.key
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
  const big = award.size === 'big'
  const heading = { reward: '🎉 You got it!', screen_time: '⏱️ Time added!', badge: '🏅 New badge!', level: '⬆️ Level up!' }[award.kind]
  const tier = award.kind === 'badge' ? award.detail : ''
  const ring = TIER_NAMES.includes(tier as never) ? TIER_COLORS[tier] : undefined
  const unlocked = award.kind === 'level' ? (award.unlocked ?? []) : []
  const title = award.title
  return (
    <div className="award-back">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="award-heading"
        aria-describedby="award-title"
        className={big ? 'award-card' : 'award-card award-toast'}
      >
        {big && Array.from({ length: 20 }, (_, i) => <span key={i} className="award-confetti" style={{ '--i': i } as React.CSSProperties} />)}
        {award.glyph && <Icon name={award.glyph} size={big ? 56 : 36} />}
        <p id="award-heading" className="f-display" style={{ margin: 0, fontSize: big ? 28 : 20 }}>
          {heading}
        </p>
        <strong
          id="award-title"
          className={ring ? 'award-ring' : undefined}
          style={{ fontSize: big ? 32 : 20, ...(ring && { '--ring': ring }) } as React.CSSProperties}
        >
          {title}
        </strong>
        {tier && <span className="f-cap">{tier}</span>}
        {unlocked.length > 0 && (
          <>
            <span className="f-cap">New flair unlocked</span>
            <div className="f-row" style={{ justifyContent: 'center' }}>
              {unlocked.map((u) => (
                <span key={u.id} className="f-pill">{`${u.emblem ?? ''} ${u.label}`.trim()}</span>
              ))}
            </div>
            {onLocker && (
              <Button
                size="lg"
                variant="default"
                onClick={() => {
                  close()
                  onLocker()
                }}
              >
                Go to Locker
              </Button>
            )}
          </>
        )}
        <Button ref={btn} size="lg" onClick={close}>
          Nice!
        </Button>
      </div>
    </div>
  )
}
