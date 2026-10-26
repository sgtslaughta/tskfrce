import { useState } from 'react'
import { usePatchScreenTime, useScreenTime, type ScreenPatch } from '@/v2/hooks/useScreenTime'
import { Icon } from '@/v2/parent/Icon'
import { ErrorPanel, Skeleton } from '@/v2/parent/states'
import type { ScreenTime } from '@/v2/types'
import { initial, intError, wallTime } from './choreMeta'
import { Switch } from './RewardDetail'
import { MaxOptions, ScreenLimits } from './ScreenLimits'
import { toastFail, toastOk } from '../notify'

/** 45 → "45 min", 60 → "1h", 645 → "10h 45m" */
export const fmtMin = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`)

function HowItWorks({ st }: { st: ScreenTime }) {
  const patch = usePatchScreenTime()
  const [draft, setDraft] = useState<ScreenPatch>({})
  const [price, setPrice] = useState(String(st.price))
  const val = <K extends keyof ScreenPatch>(k: K) => (k in draft ? draft[k] : st[k]) as ScreenTime[K]
  const set = (p: ScreenPatch) => setDraft((d) => ({ ...d, ...p }))
  const priceErr = intError(price, 1, 1000)
  const changed: ScreenPatch = Object.fromEntries(Object.entries(draft).filter(([k, v]) => v !== st[k as keyof ScreenPatch]))
  if (!priceErr && Number(price) !== st.price) changed.price = Number(price)
  const dirty = Object.keys(changed).length > 0
  const save = () =>
    patch.mutate(changed, {
      onError: toastFail,
      onSuccess: () => (toastOk('Saved'), setDraft({})),
    })
  return (
    <section className="pk-panel" aria-label="How it works">
      <h3>
        <Icon name="tune" size={18} className="rw-h3i" />
        How it works
      </h3>
      <Switch id="st-enabled" label="Kids can buy extra minutes" on={val('enabled')} onChange={(v) => set({ enabled: v })} />
      <div className="rw-form">
        <label className="pk-field">
          <span className="pk-label">Price</span>
          <span className="pk-input rw-unit">
            <input aria-label="Price (points per 15 min)" inputMode="numeric" value={price} aria-invalid={!!priceErr} onChange={(e) => setPrice(e.currentTarget.value)} />
            <span aria-hidden="true">pts per 15 min</span>
          </span>
          {priceErr && <span className="pk-error">{priceErr}</span>}
        </label>
        <label className="pk-field">
          <span className="pk-label">Max per day</span>
          <select
            className="pk-input"
            aria-label="Max per day"
            value={val('max_minutes_per_day') ?? ''}
            onChange={(e) => set({ max_minutes_per_day: e.currentTarget.value ? Number(e.currentTarget.value) : null })}
          >
            <MaxOptions keep={st.max_minutes_per_day} />
          </select>
        </label>
      </div>
      <Switch id="st-auto" label="Approve automatically" on={val('auto_approve')} onChange={(v) => set({ auto_approve: v })} />
      <Switch id="st-hours" label="Only during allowed hours" on={val('only_in_allowed_hours')} onChange={(v) => set({ only_in_allowed_hours: v })} />
      {!val('only_in_allowed_hours') && <span className="pk-hint pk-hint-tight">Bought minutes work even outside allowed hours.</span>}
      <div className="pk-actions">
        <button type="button" className="p-btn" data-variant="accent" disabled={!dirty || patch.isPending} aria-busy={patch.isPending} onClick={save}>
          <Icon name="check" />
          Save
        </button>
      </div>
    </section>
  )
}

/** Rewards → Screen time: settings, what points buy, bought today, per-kid limits. */
export function ScreenTimePane() {
  const q = useScreenTime()
  const st = q.data
  if (q.isPending) return <Skeleton />
  if (q.isError || !st) return <ErrorPanel kind="unreachable" error={q.error} onRetry={() => q.refetch()} />
  const buys = (pts: number) => fmtMin(Math.floor(pts / st.price) * 15)
  return (
    <div className="pk-detail">
      <header className="pk-head">
        <div className="pk-head-t">
          <h2>Screen time</h2>
          <div className="p-header-chips">
            <span className="p-header-chip" data-tone={st.enabled ? 'acc' : undefined}>
              <Icon name={st.enabled ? 'toggle_on' : 'toggle_off'} size={16} />
              {st.enabled ? 'On' : 'Off'}
            </span>
            <span className="p-header-chip">
              <Icon name="stars" size={16} />
              {st.price} pts = 15 min
            </span>
            <span className="p-header-chip">
              <Icon name="hourglass_bottom" size={16} />
              {st.max_minutes_per_day ? `Max ${st.max_minutes_per_day} min/day` : 'No daily max'}
            </span>
          </div>
        </div>
      </header>
      <div className="rw-g2">
        <HowItWorks key={JSON.stringify([st.enabled, st.price, st.max_minutes_per_day, st.auto_approve, st.only_in_allowed_hours])} st={st} />
        <section className="pk-panel rw-rows" aria-label="What points buy">
          <h3>
            <Icon name="calculate" size={18} className="rw-h3i" />
            What points buy
          </h3>
          <div className="rw-kv">
            <span>Average chore ({st.avg_chore_points} pts)</span>
            {fmtMin(Math.round((st.avg_chore_points * 15) / st.price))}
          </div>
          {st.kids.map((k) => (
            <div key={k.kid_id} className="rw-kv">
              <span>
                {k.name ?? 'Kid'} · {k.balance} pts
              </span>
              up to {buys(k.balance)}
            </div>
          ))}
        </section>
      </div>
      <section className="pk-panel rw-rows" aria-label="Bought today">
        <h3>
          <Icon name="timer" size={18} className="rw-h3i" />
          <span className="rw-grow">Bought today</span>
          <span className="rw-aside">resets {wallTime(st.reset_time)}</span>
        </h3>
        {st.kids.map((k) => (
          <div key={k.kid_id} className="rw-kv">
            <span className="rw-who">
              <span className="rw-avx" aria-hidden="true">
                {initial(k.name ?? 'Kid')}
              </span>
              {k.name ?? 'Kid'}
            </span>
            <span className="pt-prog rw-prog">
              {k.max_minutes ? (
                <span className="pt-bar">
                  <i style={{ width: `${Math.min(100, (k.bought_today / k.max_minutes) * 100)}%` }} />
                </span>
              ) : null}
              <b>{k.max_minutes ? `${k.bought_today} / ${k.max_minutes} min` : `${k.bought_today} min`}</b>
            </span>
          </div>
        ))}
      </section>
      <ScreenLimits kids={st.kids} />
    </div>
  )
}
