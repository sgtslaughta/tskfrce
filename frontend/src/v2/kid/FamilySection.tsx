import { useState } from 'react'
import { Leaderboard } from '../components/Leaderboard'
import { ProfileModal } from '../components/ProfileModal'
import { StickerCard } from '../components/StickerCard'
import { useLeaderboard, useProfiles } from '../hooks/useCommunity'

/** Kid view of the family: weekly leaderboard and sibling cards that open a profile. */
export function FamilySection({ meId }: { meId?: number | null }) {
  const board = useLeaderboard(true).data
  const profiles = useProfiles(true).data
  const [open, setOpen] = useState<number | null>(null)
  const sibs = (profiles ?? []).filter((p) => p.kid_id !== meId)
  if (!board && !sibs.length) return null
  return (
    <section aria-label="Family" style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>Family</h2>
      {board && <Leaderboard rows={board.rows} kid />}
      {sibs.map((p) => (
        <StickerCard key={p.kid_id}>
          <button
            type="button"
            onClick={() => setOpen(p.kid_id)}
            aria-label={`See ${p.name}'s profile`}
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', width: '100%', minHeight: 48 }}
          >
            <span aria-hidden>{p.avatar}</span>
            <b style={{ flex: 1 }}>{p.name}</b>
            <span className="f-pill">{`Lv ${p.level} · ${p.title}`}</span>
          </button>
        </StickerCard>
      ))}
      <ProfileModal kidId={open} kid onClose={() => setOpen(null)} />
    </section>
  )
}
