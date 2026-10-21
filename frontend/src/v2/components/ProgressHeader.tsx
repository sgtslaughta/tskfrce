import { NameCard } from '../flair/NameCard'
import { useEmblems } from '../hooks/useEmblems'
import { NO_FLAIR } from '../flair/none'
import type { Progress } from '../types'

/** Flair name card with XP bar and streak for a kid card header. */
export function ProgressHeader({
  name,
  avatar = null,
  kid = false,
  progress: p,
  size = 'md',
}: {
  name: string
  avatar?: string | null
  kid?: boolean
  progress?: Progress
  size?: 'sm' | 'md' | 'lg'
}) {
  const emblems = useEmblems(kid)
  if (!p) return <span className="f-display">{name}</span>
  const span = Math.max(1, p.next - p.floor)
  const pct = Math.min(100, Math.max(0, Math.round(((p.xp - p.floor) / span) * 100)))
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <NameCard name={name} avatar={avatar} level={p.level} title={p.title} flair={p.flair ?? NO_FLAIR} emblems={emblems} size={size}>
        <div className="xp-bar" role="progressbar" aria-label="XP to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="f-row" style={{ gap: 8 }}>
          <span className="f-cap">
            <span className="f-num">{p.xp}</span> / <span className="f-num">{p.next}</span> XP
          </span>
          <span className="f-cap">{p.streak > 0 ? `${p.streak} day streak` : 'No streak yet'}</span>
        </div>
      </NameCard>
    </div>
  )
}
