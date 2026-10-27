import type { CSSProperties } from 'react'
import { TIER_NAMES, TIER_STYLE } from '@/v2/tiers'

const pip = (n: number): CSSProperties => ({ background: TIER_STYLE[TIER_NAMES[n - 1]].fill, borderColor: TIER_STYLE[TIER_NAMES[n - 1]].edge })

/** 1 → "Copper" … 5 → "Mega-diamond"; 0 → "". */
export const tierLabel = (tier: number) => (tier > 0 ? TIER_NAMES[Math.min(tier, 5) - 1].replace(/^./, (c) => c.toUpperCase()) : '')

/** Five pips filled up to `tier` (copper … mega-diamond). */
export function TierPips({ tier }: { tier: number }) {
  return (
    <span className="bd-pips" role="img" aria-label={tierLabel(tier) || 'Not earned'}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} style={n <= tier ? pip(n) : undefined} />
      ))}
    </span>
  )
}

/** Tier colour key shown above the badge grid. */
export function TierLegend() {
  return (
    <div className="bd-tlg" aria-label="Tiers">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n}>
          <i style={pip(n)} aria-hidden="true" />
          {tierLabel(n)}
        </span>
      ))}
    </div>
  )
}
