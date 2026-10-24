import { LockBadge } from '../components/LockBadge'
import { StickerCard } from '../components/StickerCard'

export function UnlockedView({ points, done }: { points: number; done: number }) {
  return (
    <StickerCard tone="green">
      <div style={{ display: 'grid', justifyItems: 'center', gap: 8, padding: 12, textAlign: 'center' }}>
        <LockBadge online size={120} />
        <h1 style={{ margin: 0, fontSize: 36 }}>You&apos;re online</h1>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>⭐ <span className="f-num">{points}</span> points</p>
        <p style={{ margin: 0, fontSize: 18 }}>{done === 1 ? '1 chore' : `${done} chores`} done today</p>
      </div>
    </StickerCard>
  )
}
