import type { ScreenKid } from '@/v2/types'
import { initial } from './choreMeta'

/** One initial circle per kid: filled when their balance covers `price` right now. */
export function AffordDots({ price, kids }: { price: number; kids: ScreenKid[] }) {
  return (
    <span className="rw-dots">
      {kids.map((k) => {
        const name = k.name ?? 'Kid'
        const ok = k.balance >= price
        return (
          <span key={k.kid_id} className="rw-dot" data-ok={ok || undefined} role="img" aria-label={ok ? `${name} can afford it` : `${name} can't afford it yet`}>
            {initial(name)}
          </span>
        )
      })}
    </span>
  )
}
