import type { LeaderboardRow } from '../types'

/** This week's family ranking; ties share a rank and are marked. */
export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (!rows.length) return null
  return (
    <div className="f-card">
      <div className="f-cap">This week</div>
      <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
        {rows.map((r, i) => {
          const tied = rows.some((o, j) => j !== i && o.rank === r.rank)
          return (
            <li key={r.kid_id} className="f-row" style={{ padding: '6px 0', flexWrap: 'nowrap' }}>
              <b className="f-num" style={{ width: 36 }}>{`${tied ? 'T' : ''}${r.rank}`}</b>
              <span aria-hidden>{r.avatar}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {r.name} <span className="f-cap">{`Lv ${r.level} · ${r.title}`}</span>
              </span>
              <b className="f-num">{`${r.score} pts`}</b>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
