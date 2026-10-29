import { useCustomBadges, useRecentAwards } from '@/v2/hooks/useCustomBadges'
import { Icon } from '@/v2/parent/Icon'

export type BadgesItem = 'all' | 'custom' | 'recent'

/** Badges list column: All badges, Custom badges, Recent awards. */
export function BadgesNav({ selected, onSelect }: { selected?: string; onSelect: (item: BadgesItem) => void }) {
  const made = useCustomBadges().data?.length ?? 0
  const recent = useRecentAwards().data?.length ?? 0
  const items = [
    { id: 'all' as const, icon: 'military_tech', name: 'All badges', sub: 'Who has what, by tier' },
    { id: 'custom' as const, icon: 'auto_awesome', name: 'Custom badges', sub: `${made} made by you · award one` },
    { id: 'recent' as const, icon: 'celebration', name: 'Recent awards', sub: `${recent} this week`, count: recent },
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
          {!!it.count && (
            <span className="rw-badge" aria-label={`${it.count} new`}>
              {it.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
