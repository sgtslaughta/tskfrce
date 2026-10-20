import type { ReactNode } from 'react'

export type StickerTone = 'sun' | 'red' | 'green' | 'mute'

/** Outlined fridge card: 3px ink border, 18px radius, hard 4px shadow. */
export function StickerCard({ children, tone }: { children: ReactNode; tone?: StickerTone }) {
  return (
    <div className="f-card" data-tone={tone}>
      {children}
    </div>
  )
}
