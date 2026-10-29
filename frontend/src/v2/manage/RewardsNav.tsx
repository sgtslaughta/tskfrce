import type { ReactNode } from 'react'
import { usePendingRedemptions, useRewards } from '@/v2/hooks/useRewards'
import { useScreenTime } from '@/v2/hooks/useScreenTime'
import { Chip } from '@/v2/parent/Chip'
import { Icon } from '@/v2/parent/Icon'

export type RewardsItem = 'requests' | 'catalogue' | 'screen' | 'history'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Rewards list column: Requests, Catalogue, Screen time, History. */
export function RewardsNav({ selected, onSelect }: { selected?: string; onSelect: (item: RewardsItem) => void }) {
  const waiting = usePendingRedemptions().data?.length
  const rewards = useRewards().data ?? []
  const st = useScreenTime().data
  const hidden = rewards.filter((r) => !r.visible).length
  const items: { id: RewardsItem; icon: string; name: string; sub: string; end?: ReactNode }[] = [
    {
      id: 'requests',
      icon: 'pending_actions',
      name: 'Requests',
      sub: waiting === undefined ? '' : waiting ? `${waiting} waiting for you` : 'Nothing waiting',
      end: !!waiting && (
        <span className="rw-badge" aria-label={`${waiting} waiting`}>
          {waiting}
        </span>
      ),
    },
    { id: 'catalogue', icon: 'storefront', name: 'Catalogue', sub: `${plural(rewards.length, 'reward')} · ${hidden} hidden` },
    {
      id: 'screen',
      icon: 'timer',
      name: 'Screen time',
      sub: st?.price != null ? `${st.price} pts per 15 min` : 'Buy minutes with points',
      end: st && (st.enabled ? <Chip tone="acc" icon="toggle_on">On</Chip> : <Chip tone="grey" icon="toggle_off">Off</Chip>),
    },
    { id: 'history', icon: 'history', name: 'History', sub: 'Last 30 days' },
  ]
  return (
    <div className="pk-items">
      {items.map((it) => (
        <button key={it.id} type="button" className="pk-card" data-selected={selected === it.id} onClick={() => onSelect(it.id)}>
          <span className="pk-tile">
            <Icon name={it.icon} size={20} />
          </span>
          <span className="pk-card-t">
            <b>{it.name}</b>
            <small>{it.sub}</small>
          </span>
          {it.end}
        </button>
      ))}
    </div>
  )
}
