import { useState } from 'react'
import { Leaderboard } from '../components/Leaderboard'
import { ProfileModal } from '../components/ProfileModal'
import { StickerCard } from '../components/StickerCard'
import { useLeaderboard, useProfiles } from '../hooks/useCommunity'
import { useAsKid } from '../hooks/usePreview'

/** Kid view of the family: weekly leaderboard and sibling cards that open a profile. */
export function FamilySection({ meId }: { meId?: number | null }) {
  const kidAuth = useAsKid() === null // previewing parents use their own token
  const board = useLeaderboard(kidAuth).data
  const profiles = useProfiles(kidAuth).data
  const [open, setOpen] = useState<number | null>(null)
  const sibs = (profiles ?? []).filter((p) => p.kid_id !== meId)
  if (!board && !sibs.length) return null
  return (
    <StickerCard>
      <section aria-label="Family" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Family</h2>
        {board && <Leaderboard rows={board.rows} kid={kidAuth} bare />}
        {sibs.map((p) => (
          <button
            key={p.kid_id}
            type="button"
            onClick={() => setOpen(p.kid_id)}
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', width: '100%', minHeight: 48, borderTop: '1px solid var(--f-line)' }}
          >
            <span aria-hidden>{p.avatar}</span>
            <b style={{ flex: 1 }}>{p.name}</b>
            <span className="f-pill">{`Lv ${p.level} · ${p.title}`}</span>
          </button>
        ))}
        <ProfileModal kidId={open} kid={kidAuth} onClose={() => setOpen(null)} />
      </section>
    </StickerCard>
  )
}
