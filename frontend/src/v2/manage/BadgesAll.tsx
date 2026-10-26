import { badgeGlyph } from '@/v2/badgeGlyphs'
import { useBadgeOverview, useRecentAwards } from '@/v2/hooks/useCustomBadges'
import { useKids } from '@/v2/hooks/useKids'
import { Chip } from '@/v2/parent/Chip'
import { Icon } from '@/v2/parent/Icon'
import { ErrorPanel, Skeleton } from '@/v2/parent/states'
import type { Kid } from '@/v2/types'
import { initial, nameOf } from './choreMeta'
import { TierLegend, TierPips, tierLabel } from './TierPips'

interface CardProps {
  glyph: string
  name: string
  description: string
  custom: boolean
  tiers: Record<string, number>
  kids: Kid[]
  selected?: boolean
  onClick?: () => void
}

/** A badge: glyph tile, name, description, and one tier row per kid. A button when `onClick` is set. */
export function BadgeCard({ glyph, name, description, custom, tiers, kids, selected, onClick }: CardProps) {
  const body = (
    <>
      <span className="bd-top">
        <span className="bd-glyph">
          <Icon name={glyph} size={22} />
        </span>
        <span className="bd-t">
          <b>
            {name}
            {custom && (
              <Chip tone="lav" icon="auto_awesome" className="bd-custom">
                Custom
              </Chip>
            )}
          </b>
          {description && <small>{description}</small>}
        </span>
      </span>
      <span className="bd-tiers">
        {kids.map((k) => {
          const t = tiers[String(k.id)] ?? 0
          return (
            <span key={k.id} className="bd-tk">
              <span className="rw-avx" title={nameOf(k)}>
                {initial(nameOf(k))}
              </span>
              <TierPips tier={t} />
              <span className="bd-tn">{tierLabel(t) || '—'}</span>
            </span>
          )
        })}
      </span>
    </>
  )
  return onClick ? (
    <button type="button" className="bd-card" data-selected={selected} onClick={onClick}>
      {body}
    </button>
  ) : (
    <article className="bd-card">{body}</article>
  )
}

/** All badges pane: every built-in and custom badge with each kid's tier. */
export function BadgesAll() {
  const overview = useBadgeOverview()
  const recent = useRecentAwards().data?.length ?? 0
  const kids = useKids().data ?? []
  const items = overview.data ?? []
  const custom = items.filter((b) => b.custom).length
  return (
    <div className="pk-detail">
      <header className="pk-head">
        <div className="pk-head-t">
          <h2>Badges</h2>
          <div className="p-header-chips">
            <span className="p-header-chip">
              <Icon name="military_tech" size={16} />
              {items.length - custom} built-in
            </span>
            <span className="p-header-chip">
              <Icon name="auto_awesome" size={16} />
              {custom} custom
            </span>
            <span className="p-header-chip" data-tone="acc">
              <Icon name="celebration" size={16} />
              {recent} new this week
            </span>
          </div>
        </div>
      </header>
      <TierLegend />
      {overview.isPending ? (
        <Skeleton />
      ) : overview.isError ? (
        <ErrorPanel kind="unreachable" error={overview.error} onRetry={() => overview.refetch()} />
      ) : (
        <div className="bd-grid">
          {items.map((b) => (
            <BadgeCard key={b.key} glyph={badgeGlyph(b)} name={b.name} description={b.description} custom={b.custom} tiers={b.tiers} kids={kids} />
          ))}
        </div>
      )}
    </div>
  )
}
