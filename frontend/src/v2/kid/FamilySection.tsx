import { useState } from 'react'
import { NameCard } from '../flair/NameCard'
import { NO_FLAIR } from '../flair/none'
import { useEmblems } from '../hooks/useEmblems'
import { Leaderboard } from '../components/Leaderboard'
import { ProfileModal } from '../components/ProfileModal'
import { useLeaderboard, useProfiles } from '../hooks/useCommunity'
import { useAsKid } from '../hooks/usePreview'

/** Kid view of the family, one row per member. Kid/Teen: the weekly ranking, sibling rows open a profile.
 *  Little: only the big sibling cards (no ranking). Without a ranking, cards for everyone. */
export function FamilySection({ meId, little = false }: { meId?: number | null; little?: boolean }) {
  const kidAuth = useAsKid() === null // previewing parents use their own token
  const board = useLeaderboard(kidAuth).data
  const profiles = useProfiles(kidAuth).data
  const emblems = useEmblems(kidAuth)
  const [open, setOpen] = useState<number | null>(null)
  const ranked = board?.rows.length && !little ? board : null
  const sibs = ranked ? [] : (profiles ?? []).filter((p) => p.kid_id !== meId)
  if (!ranked && !sibs.length) return null
  return (
    <section className="me-card" aria-label="Family">
      <h2 className="me-h k-disp">Family</h2>
      {ranked && <Leaderboard rows={ranked.rows} kid={kidAuth} bare onPick={setOpen} meId={meId} />}
      {sibs.map((p) => (
        <button key={p.kid_id} type="button" className="lb-pick" onClick={() => setOpen(p.kid_id)}>
          <NameCard name={p.name} avatar={p.avatar} level={p.level} title={p.title} flair={p.flair ?? NO_FLAIR} emblems={emblems} size="sm" />
          <span className="k-sr">, open profile</span>
        </button>
      ))}
      <ProfileModal kidId={open} kid={kidAuth} onClose={() => setOpen(null)} />
    </section>
  )
}
