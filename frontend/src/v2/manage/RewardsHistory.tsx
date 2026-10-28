import { useState } from 'react'
import { useKids } from '@/v2/hooks/useKids'
import { useRewardHistory, type HistoryQuery } from '@/v2/hooks/useRewards'
import { Chip } from '@/v2/parent/Chip'
import { Icon } from '@/v2/parent/Icon'
import { EmptyState, ErrorPanel, Skeleton } from '@/v2/parent/states'
import type { HistoryRow } from '@/v2/types'
import { daysAgo } from '../clockText'
import { initial } from './choreMeta'
import { downloadCsv, toCsv } from './historyCsv'
import { fmtMin } from './ScreenTimePane'

type Kind = NonNullable<HistoryQuery['kind']>

/** "Today 5:12 PM", "Yesterday", "Mon", else "Oct 3". */
export function whenAt(iso: string, now = new Date()) {
  const d = new Date(iso)
  const diff = daysAgo(iso, now)
  if (diff === 0) return `Today ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function Row({ r }: { r: HistoryRow }) {
  const kid = r.kid_name ?? 'Kid'
  const by = r.decided_by_name ?? 'a parent'
  const how = r.auto ? 'auto-approved' : r.status === 'denied' ? `declined by ${by}` : `approved by ${by}`
  const denied = r.status === 'denied'
  return (
    <li className="rw-kv rw-hrow">
      <span className="rw-who">
        <span className="rw-avx" aria-hidden="true">
          {initial(kid)}
        </span>
        <span className="rw-hname">
          {r.name}
          <small>
            {kid} · {whenAt(r.decided_at ?? r.created_at)} · {how}
            {r.note && ` · “${r.note}”`}
          </small>
        </span>
      </span>
      <span className="rw-hend">
        {r.auto ? (
          <Chip tone="lav" icon="bolt">Auto</Chip>
        ) : denied ? (
          <Chip tone="grey" icon="close">Declined</Chip>
        ) : (
          <Chip tone="acc" icon="check">Approved</Chip>
        )}
        <b className={denied ? 'rw-amt rw-amt-off' : 'rw-amt'}>{denied ? '0' : `−${r.cost}`}</b>
      </span>
    </li>
  )
}

/** Rewards → History: 30-day totals, kid/type filters, rows, Export CSV. */
export function RewardsHistory() {
  const kids = useKids().data ?? []
  const [kidId, setKidId] = useState<number | undefined>()
  const [kinds, setKinds] = useState<Kind[]>([])
  const kind = kinds.length === 1 ? kinds[0] : undefined
  const q = useRewardHistory({ days: 30, kid_id: kidId, kind })
  const rows = q.data?.rows ?? []
  const t = q.data?.totals
  const toggle = (k: Kind) => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]))
  const kpis: [string, string][] = t
    ? [
        ['Spent · 30 days', t.spent.toLocaleString()],
        ['Screen time bought', fmtMin(t.screen_minutes)],
        ['Approved', String(t.approved)],
        ['Declined', String(t.declined)],
      ]
    : []
  return (
    <div className="pk-detail">
      <header className="pk-head">
        <div className="pk-head-t">
          <h2>History</h2>
          <p className="rw-sub">Every reward and screen-time purchase.</p>
        </div>
        <button type="button" className="p-btn" disabled={!rows.length} onClick={() => downloadCsv('rewards-history.csv', toCsv(rows))}>
          <Icon name="download" />
          Export CSV
        </button>
      </header>
      {kpis.length > 0 && (
        <div className="rw-kpis">
          {kpis.map(([label, v]) => (
            <div key={label} className="rw-kpi">
              <span>{label}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
      )}
      <section className="pk-panel rw-rows" aria-label="History rows">
        <div className="rw-filters" role="group" aria-label="Filter">
          <Icon name="filter_list" size={18} className="rw-h3i" />
          <button type="button" className="rw-ev" aria-pressed={kidId == null} onClick={() => setKidId(undefined)}>
            All kids
          </button>
          {kids.map((k) => (
            <button key={k.id} type="button" className="rw-ev" aria-pressed={kidId === k.id} onClick={() => setKidId(k.id)}>
              {k.full_name}
            </button>
          ))}
          <span className="rw-gap" />
          <button type="button" className="rw-ev" aria-pressed={kinds.includes('reward')} onClick={() => toggle('reward')}>
            Rewards
          </button>
          <button type="button" className="rw-ev" aria-pressed={kinds.includes('screen_time')} onClick={() => toggle('screen_time')}>
            Screen time
          </button>
        </div>
        {q.isPending ? (
          <Skeleton />
        ) : q.isError ? (
          <ErrorPanel kind="unreachable" error={q.error} onRetry={() => q.refetch()} />
        ) : rows.length ? (
          <ul className="rw-hlist">
            {rows.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        ) : (
          <EmptyState icon="history" title="Nothing yet" body="Rewards and screen time kids buy show up here." />
        )}
      </section>
    </div>
  )
}
