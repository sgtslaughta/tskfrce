import { NameCard } from '../flair/NameCard'
import { NO_FLAIR } from '../flair/none'
import { useEmblems } from '../hooks/useEmblems'
import type { LeaderboardRow } from '../types'

/** This week's family ranking; ties share a rank and are marked. */
/** `onPick` makes every row except `meId`'s a button (kid Me: tap a sibling to open their profile). */
export function Leaderboard({ rows, kid = false, bare = false, onPick, meId }: { rows: LeaderboardRow[]; kid?: boolean; bare?: boolean; onPick?: (kidId: number) => void; meId?: number | null }) {
  const emblems = useEmblems(kid)
  if (!rows.length) return null
  const card = (r: LeaderboardRow) => {
    const nc = <NameCard name={r.name} avatar={r.avatar} level={r.level} title={r.title} flair={r.flair ?? NO_FLAIR} emblems={emblems} size="sm" />
    return onPick && r.kid_id !== meId ? (
      <button type="button" className="lb-pick" onClick={() => onPick(r.kid_id)}>
        {nc}
        <span className="k-sr">, open profile</span>
      </button>
    ) : (
      nc
    )
  }
  return (
    <div className={bare ? undefined : 'f-card'}>
      <div className="f-cap">This week</div>
      <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
        {rows.map((r, i) => {
          const tied = rows.some((o, j) => j !== i && o.rank === r.rank)
          return (
            <li key={r.kid_id} className="f-row" style={{ padding: '6px 0', flexWrap: 'nowrap' }}>
              <b className="f-num" style={{ width: 36 }}>{`${tied ? 'T' : ''}${r.rank}`}</b>
              <div style={{ flex: 1, minWidth: 0 }}>
                {card(r)}
              </div>
              <b className="f-num" style={{ flex: 'none', width: '9ch', textAlign: 'right' }}>{`${r.score} pts`}</b>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
