import { badgeGlyph } from '@/v2/badgeGlyphs'
import { useRecentAwards } from '@/v2/hooks/useCustomBadges'
import { Icon } from '@/v2/parent/Icon'
import { EmptyState, ErrorPanel, Skeleton } from '@/v2/parent/states'
import type { RecentAward } from '@/v2/types'
import { daysAgo } from '../clockText'
import { TierPips, tierLabel } from './TierPips'

/** "today", "yesterday", "Mon", else "Oct 3". */
export function dayWord(iso: string, now = new Date()) {
  const d = new Date(iso)
  const diff = daysAgo(iso, now)
  if (diff <= 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function AwardRow({ a }: { a: RecentAward }) {
  const kid = a.kid_name ?? 'Kid'
  const when = dayWord(a.earned_at)
  const sub = (a.by_name ? [`Given by ${a.by_name}`, a.note && `“${a.note}”`, when] : [a.reason ? `Automatic · ${a.reason}` : 'Automatic', when]).filter(Boolean).join(' · ')
  return (
    <li className="bd-aw">
      <span className="bd-glyph bd-glyph-sm">
        <Icon name={badgeGlyph(a)} size={20} />
      </span>
      <span className="bd-aw-t">
        <span>{`${kid} ${a.custom ? 'got' : 'reached'} ${a.name} · ${tierLabel(a.tier)}`}</span>
        <small>{sub}</small>
      </span>
      <TierPips tier={a.tier} />
    </li>
  )
}

/** Recent awards pane: the last 7 days of built-in tiers and parent awards. */
export function BadgesRecent() {
  const recent = useRecentAwards()
  const rows = recent.data ?? []
  return (
    <div className="pk-detail" tabIndex={0}>
      <header className="pk-head">
        <div className="pk-head-t">
          <h2>Recent awards</h2>
          <p className="rw-sub">Earned automatically or given by a parent.</p>
        </div>
      </header>
      {recent.isPending ? (
        <Skeleton />
      ) : recent.isError ? (
        <ErrorPanel kind="unreachable" error={recent.error} onRetry={() => recent.refetch()} />
      ) : rows.length ? (
        <section className="pk-panel">
          <ul className="bd-awl">
            {rows.map((a) => (
              <AwardRow key={a.id} a={a} />
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState icon="celebration" title="No awards this week" body="Badges kids earn, and ones you give, show up here." />
      )}
    </div>
  )
}
