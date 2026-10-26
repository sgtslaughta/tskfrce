import { useState } from 'react'
import { useAwardBadge, useBadgeOverview, useCustomBadges } from '@/v2/hooks/useCustomBadges'
import { useKids } from '@/v2/hooks/useKids'
import { Icon } from '@/v2/parent/Icon'
import { EmptyState, ErrorPanel, Skeleton } from '@/v2/parent/states'
import type { CustomBadge, Kid } from '@/v2/types'
import { BadgeCard } from './BadgesAll'
import { BadgeDetail } from './BadgeDetail'
import { initial, nameOf } from './choreMeta'
import { tierLabel } from './TierPips'
import { useSingle } from './useSingle'
import { toastFail, toastOk } from '../notify'

/** Award it: pick a kid, preview their next tier, add an optional note. */
function AwardPanel({ badge, kids, tiers }: { badge: CustomBadge; kids: Kid[]; tiers: Record<string, number> }) {
  const award = useAwardBadge()
  const awardOnce = useSingle(award)
  const [kidId, setKidId] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const kid = kids.find((k) => k.id === kidId) ?? kids[0]
  if (!kid) return null
  const who = nameOf(kid)
  const tier = tiers[String(kid.id)] ?? 0
  const maxed = tier >= 5
  const give = () =>
    awardOnce(
      { id: badge.id, kid_id: kid.id, ...(note.trim() && { note: note.trim() }) },
      { onError: toastFail, onSuccess: (r) => (setNote(''), toastOk(`${badge.name}: ${tierLabel(r.tier)}`)) },
    )
  return (
    <section className="pk-panel" aria-label="Award it">
      <h3>
        <Icon name="redeem" size={18} />
        Award it
      </h3>
      <div className="pk-pills" role="group" aria-label="Award to">
        {kids.map((k) => (
          <button key={k.id} type="button" className="pk-pill bd-kp" aria-pressed={k.id === kid.id} onClick={() => setKidId(k.id)}>
            <span className="pk-av" aria-hidden="true">
              {initial(nameOf(k))}
            </span>
            {nameOf(k)}
          </button>
        ))}
      </div>
      <div className="rw-kv bd-preview" data-testid="award-preview">
        <span>{maxed ? who : tier ? `${who} goes` : `${who} gets`}</span>
        <span className="bd-next">
          {maxed ? (
            'Already Mega-diamond'
          ) : (
            <>
              {tier > 0 && (
                <>
                  {tierLabel(tier)}
                  <Icon name="arrow_forward" size={18} />
                </>
              )}
              <b>{tierLabel(tier + 1)}</b>
            </>
          )}
        </span>
      </div>
      <label className="pk-field">
        <span className="pk-label">{`Note to ${who} (optional)`}</span>
        <input className="pk-input" value={note} maxLength={200} onChange={(e) => setNote(e.currentTarget.value)} />
      </label>
      <button type="button" className="p-btn rw-self-start" data-variant="accent" disabled={maxed || award.isPending} aria-busy={award.isPending} onClick={give}>
        <Icon name={award.isPending ? 'progress_activity' : 'military_tech'} className={award.isPending ? 'pk-spin' : ''} />
        {`Award to ${who}`}
      </button>
    </section>
  )
}

/** Custom badges pane: card grid, then the editor and Award it for `pick` (default: the first badge). */
export function BadgesCustom({ pick, onPick }: { pick?: string; onPick: (id: number | 'new' | null) => void }) {
  const badges = useCustomBadges()
  const overview = useBadgeOverview().data ?? []
  const kids = useKids().data ?? []
  const list = badges.data ?? []
  const picked = pick === 'new' ? undefined : (list.find((b) => String(b.id) === pick) ?? list[0])
  const tiersOf = (id: number) => overview.find((o) => o.key === `custom:${id}`)?.tiers ?? {}
  return (
    <div className="pk-detail">
      <header className="pk-head">
        <div className="pk-head-t">
          <h2>Custom badges</h2>
          <p className="rw-sub">Your own badges. Each award moves that kid up a tier.</p>
        </div>
        <button type="button" className="p-btn" data-variant="accent" onClick={() => onPick('new')}>
          <Icon name="add" />
          New badge
        </button>
      </header>
      {badges.isPending ? (
        <Skeleton />
      ) : badges.isError ? (
        <ErrorPanel kind="unreachable" error={badges.error} onRetry={() => badges.refetch()} />
      ) : list.length ? (
        <div className="bd-grid">
          {list.map((b) => (
            <BadgeCard
              key={b.id}
              glyph={b.icon || 'military_tech'}
              name={b.name}
              description={b.description}
              custom
              tiers={tiersOf(b.id)}
              kids={kids}
              selected={picked?.id === b.id}
              onClick={() => onPick(b.id)}
            />
          ))}
        </div>
      ) : (
        pick !== 'new' && <EmptyState icon="auto_awesome" title="No custom badges yet" body="Make one for the things you want to cheer on." />
      )}
      {(pick === 'new' || picked) && (
        <div className="rw-g2">
          {pick === 'new' ? <BadgeDetail key="new" onSelect={onPick} /> : picked && <BadgeDetail key={picked.id} badge={picked} onSelect={onPick} />}
          {picked && <AwardPanel key={picked.id} badge={picked} kids={kids} tiers={tiersOf(picked.id)} />}
        </div>
      )}
    </div>
  )
}
