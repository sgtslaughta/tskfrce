import { Icon } from '../parent/Icon'
import { MEGA_STOPS, TIER_STYLE } from '../tiers'
import type { Badge } from '../types'

const tierKey = (b: Badge) => b.tier_name.toLowerCase().replace(/[\s_]+/g, '-')

export function BadgeGrid({ badges }: { badges: Badge[] }) {
  if (!badges.length) return <p className="f-cap">No badges yet.</p>
  return (
    <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 12, listStyle: 'none', margin: 0, padding: 0 }}>
      {badges.map((b) => (
        <li key={b.key} title={b.description} style={{ display: 'grid', justifyItems: 'center', gap: 2, width: 84, textAlign: 'center' }}>
          <span
            className={`tier-ring ${tierKey(b) === 'mega-diamond' ? 'tier-mega-diamond' : ''}`}
            style={{ '--ring': TIER_STYLE[tierKey(b)]?.fill, '--edge': TIER_STYLE[tierKey(b)]?.edge, '--mega': MEGA_STOPS } as React.CSSProperties}
            aria-hidden
          >
            {b.custom ? <Icon name={b.icon} /> : b.icon}
          </span>
          <b style={{ fontSize: 13 }}>{b.name}</b>
          <span className="f-cap">{b.tier_name}</span>
        </li>
      ))}
    </ul>
  )
}
