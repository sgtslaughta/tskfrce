import { useState } from 'react'
import { Leaderboard } from '../components/Leaderboard'
import { ProfileModal } from '../components/ProfileModal'
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
    <section className="me-card" aria-label="Family">
      <h2 className="me-h k-disp">Family</h2>
      {board && <Leaderboard rows={board.rows} kid={kidAuth} bare />}
      {sibs.map((p) => (
        <button key={p.kid_id} type="button" className="me-sib" onClick={() => setOpen(p.kid_id)}>
          <span aria-hidden>{p.avatar}</span>
          <b>{p.name}</b>
          <span className="k-chip" data-tone="today" data-size="sm">{`Lv ${p.level} · ${p.title}`}</span>
        </button>
      ))}
      <ProfileModal kidId={open} kid={kidAuth} onClose={() => setOpen(null)} />
    </section>
  )
}
