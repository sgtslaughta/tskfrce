import { useEffect, useRef } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { useRewards } from '@/v2/hooks/useRewards'
import { useScreenTime } from '@/v2/hooks/useScreenTime'
import { Chip } from '@/v2/parent/Chip'
import { Icon } from '@/v2/parent/Icon'
import { AffordDots } from './AffordDots'
import { RewardDetail, rewardGlyph } from './RewardDetail'

/** Catalogue pane: reward card grid (who can afford it now) and the editor for the picked reward. */
export function RewardsCatalogue({ pick: urlPick, onPick }: { pick?: string; onPick: (id: number | 'new' | null) => void }) {
  const rewards = useRewards().data ?? []
  const kids = useScreenTime().data?.kids ?? []
  const small = useMediaQuery('(max-width: 767px)')
  // desktop opens the first reward's editor rather than an empty pane (mockup 02)
  const pick = urlPick ?? (small || !rewards.length ? undefined : String(rewards[0].id))
  const picked = rewards.find((r) => String(r.id) === pick)
  const detail = useRef<HTMLDivElement>(null)
  // phone: the editor sits under the grid, so bring it into view when a card is tapped
  useEffect(() => {
    if (small && urlPick) detail.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [small, urlPick])
  return (
    <div className="pk-detail">
      <header className="pk-head">
        <div className="pk-head-t">
          <h2>Catalogue</h2>
          <p className="rw-sub">What kids can spend points on. Circles show who can afford it now.</p>
        </div>
        <button type="button" className="p-btn" data-variant="accent" onClick={() => onPick('new')}>
          <Icon name="add" />
          New reward
        </button>
      </header>
      <div className="rw-cat">
        {rewards.map((r) => (
          <button key={r.id} type="button" className="rw-ci" data-selected={pick === String(r.id)} data-hidden={!r.visible || undefined} onClick={() => onPick(r.id)}>
            {!r.visible && (
              <Chip tone="grey" icon="visibility_off" className="rw-off">
                Hidden
              </Chip>
            )}
            <span className="rw-glyph">
              <Icon name={rewardGlyph(r.icon)} size={22} />
            </span>
            <b>{r.name}</b>
            <small>{r.price} pts</small>
            {r.visible && <AffordDots price={r.price} kids={kids} />}
          </button>
        ))}
        <button type="button" className="rw-ci rw-add" data-selected={pick === 'new'} onClick={() => onPick('new')}>
          <Icon name="add" />
          New reward
        </button>
      </div>
      <div ref={detail}>
        {pick === 'new' ? <RewardDetail key="new" onSelect={onPick} /> : picked && <RewardDetail key={picked.id} reward={picked} onSelect={onPick} />}
      </div>
    </div>
  )
}
