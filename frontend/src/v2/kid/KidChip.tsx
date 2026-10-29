import { Icon } from '@/v2/parent/Icon'
import type { KidChipT } from './kidChips'

// kid-app.css is global CSS, so it is imported in pages/_app.tsx (Next allows global CSS only there).

export type ChipSize = 'sm' | 'md' | 'lg'

/** Status chip (mockup 11 .chip.c-*); lg is Little's big badge. */
export function KidChip({ chip, size = 'md' }: { chip: KidChipT; size?: ChipSize }) {
  return (
    <span className="k-chip" data-tone={chip.tone} data-size={size}>
      <Icon name={chip.icon} />
      {chip.label}
    </span>
  )
}

/** Sun points chip: "+N", or "N points" when `long`. */
export function PointsChip({ points, size = 'md', long }: { points: number; size?: ChipSize; long?: boolean }) {
  return (
    <span className="k-chip" data-tone="sun" data-size={size}>
      <Icon name="star" fill />
      {long ? `${points} points` : `+${points}`}
    </span>
  )
}
