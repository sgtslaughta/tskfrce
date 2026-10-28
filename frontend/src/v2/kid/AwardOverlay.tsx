import { FocusTrap } from '@mantine/core'
import { useEffect, useRef } from 'react'
import { useCelebrations, useMarkCelebrationSeen } from '../hooks/useKidRewards'
import { focusPage } from './focusPage'
import { Icon } from '../parent/Icon'
import { TIER_COLORS, TIER_NAMES } from '../tiers'

export function AwardOverlay({ onExpired, onLocker }: { onExpired: () => void; onLocker?: () => void }) {
  const award = useCelebrations(onExpired).data?.[0]
  const seen = useMarkCelebrationSeen(onExpired)
  const btn = useRef<HTMLButtonElement>(null)
  const id = award?.key
  const open = id !== undefined
  const returnTo = useRef<Element | null>(null)
  if (open && !returnTo.current) returnTo.current = document.activeElement // before the trap steals focus
  useEffect(() => {
    if (open) return
    const el = returnTo.current as HTMLElement | null // the last card closed; its button may be gone
    if (el?.isConnected) el.focus?.()
    else focusPage('.r-head', 'main')
    returnTo.current = null
  }, [open])
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
  const heading = { reward: '🎉 You got it!', screen_time: '⏱️ Time added!', badge: '🏅 New badge!', level: '⬆️ Level up!', bonus: '⭐ Bonus points!' }[award.kind]
  const tier = award.kind === 'badge' ? award.detail : ''
  const note = award.kind === 'bonus' ? award.detail : award.note
  const ring = TIER_NAMES.includes(tier as never) ? TIER_COLORS[tier] : undefined
  const unlocked = award.kind === 'level' ? (award.unlocked ?? []) : []
  const title = award.title
  return (
    <div className="award-back k-tok">
      <FocusTrap active>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="award-heading"
        aria-describedby="award-title"
        className={big ? 'award-card' : 'award-card award-toast'}
      >
        {big && Array.from({ length: 20 }, (_, i) => <span key={i} className="award-confetti" style={{ '--i': i } as React.CSSProperties} />)}
        {award.glyph && <Icon name={award.glyph} size={big ? 56 : 36} />}
        <p id="award-heading" className="k-disp" style={{ margin: 0, fontSize: big ? 30 : 22 }}>
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
        {note && <span className="k-hint">{award.kind === 'bonus' ? note : `“${note}”`}</span>}
        {unlocked.length > 0 && (
          <>
            <span className="f-cap">New flair unlocked</span>
            <div className="f-row" style={{ justifyContent: 'center' }}>
              {unlocked.map((u) => (
                <span key={u.id} className="f-pill">{`${u.emblem ?? ''} ${u.label}`.trim()}</span>
              ))}
            </div>
            {onLocker && (
              <button
                type="button"
                className="k-bb"
                onClick={() => {
                  close()
                  onLocker()
                }}
              >
                Go to Locker
              </button>
            )}
          </>
        )}
        <button ref={btn} type="button" className="k-bb" data-tone="sun" onClick={close}>
          Nice!
        </button>
      </div>
      </FocusTrap>
    </div>
  )
}
