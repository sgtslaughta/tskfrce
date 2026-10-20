import type { ReactNode } from 'react'

/** Yellow label, slightly rotated, e.g. "2 chores need you". */
export function Sticker({ children }: { children: ReactNode }) {
  return <span className="f-sticker">{children}</span>
}
