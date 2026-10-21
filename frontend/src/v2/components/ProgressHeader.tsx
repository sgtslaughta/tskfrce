import type { Progress } from '../types'
import './progression.css'

/** Name, "Lv N · Title" tag, XP bar and streak for a kid card header. */
export function ProgressHeader({ name, progress: p }: { name: string; progress?: Progress }) {
  if (!p) return <span className="f-display">{name}</span>
  const span = Math.max(1, p.next - p.floor)
  const pct = Math.min(100, Math.max(0, Math.round(((p.xp - p.floor) / span) * 100)))
  return (
    <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 0 }}>
      <div className="f-row" style={{ gap: 8 }}>
        <span className="f-display" style={{ fontSize: 20, fontWeight: 600 }}>
          {name}
        </span>
        <span className="f-pill">{`Lv ${p.level} · ${p.title}`}</span>
        <span className="f-cap">{p.streak > 0 ? `${p.streak} day streak` : 'No streak yet'}</span>
      </div>
      <div className="xp-bar" role="progressbar" aria-label="XP to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="f-cap">
        <span className="f-num">{p.xp}</span> / <span className="f-num">{p.next}</span> XP
      </span>
    </div>
  )
}
