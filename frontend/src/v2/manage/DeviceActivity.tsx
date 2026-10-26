import { useState } from 'react'
import { useDeviceActivity, useLockKid, useMarkOk, useMergeDevice } from '@/v2/hooks/useDeviceActivity'
import { openChat } from '@/v2/chat/dock'
import { Icon } from '@/v2/parent/Icon'
import { EmptyState, Skeleton } from '@/v2/parent/states'
import type { Device, DeviceActivity as Activity, DeviceEvent, EventKind, Kid } from '@/v2/types'
import { eventText, whenLabel } from './activityText'
import { nameOf } from './choreMeta'
import { LockHistory } from './LockHistory'
import { toastOk } from '../notify'

// mirrors backend FILTERS (app/models/device_activity.py)
const FILTERS: { key: string; label: string; kinds?: EventKind[] }[] = [
  { key: 'all', label: 'All' },
  { key: 'bypass', label: 'Bypass', kinds: ['bypass', 'new_address'] },
  { key: 'locked', label: 'While locked', kinds: ['locked_try', 'outside_hours', 'left_wifi'] },
  { key: 'sign_in', label: 'Sign-in', kinds: ['sign_in'] },
]

// [count, desktop label, phone label (mockup 04)]
const KPIS: [keyof Activity['counts'], string, string][] = [
  ['bypass', 'Bypass attempts · 7d', 'Bypass · 7d'],
  ['locked_tries', 'Tries while locked · 7d', 'Tries while locked'],
  ['outside_hours', 'Outside allowed hours · 7d', 'Outside hours'],
  ['wrong_pins', 'Wrong PINs · 7d', 'Wrong PINs'],
]

/** "2 h 10 min" / "1 h" / "45 min" */
export const duration = (m: number) => {
  const h = Math.floor(m / 60)
  const r = Math.round(m % 60)
  return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`
}

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })

interface Props {
  device: Device
  kids: Kid[]
  timeZone?: string
}

/** Activity tab: 7-day KPIs, attempts and alerts with actions, time online per day, lock history. */
export function DeviceActivity({ device, kids, timeZone }: Props) {
  const { data, isLoading } = useDeviceActivity(device.id)
  const [filter, setFilter] = useState('all')
  const markOk = useMarkOk()
  const merge = useMergeDevice()
  const lockKid = useLockKid()
  if (isLoading || !data) return <Skeleton rows={3} />

  const now = Date.now()
  const owner = kids.find((k) => k.id === device.owner_ids[0])
  const kidOf = (e: DeviceEvent) =>
    e.kind === 'sign_in' ? (e.kid_id ? { id: e.kid_id, name: e.kid_name ?? kids.find((k) => k.id === e.kid_id)?.username ?? 'kid' } : null)
    : owner ? { id: owner.id, name: nameOf(owner) } : null
  const kinds = FILTERS.find((f) => f.key === filter)?.kinds
  const events = kinds ? data.events.filter((e) => kinds.includes(e.kind)) : data.events
  const ev = (e: DeviceEvent) => ({ deviceId: device.id, eventId: e.id })

  const actions = (e: DeviceEvent) => {
    if (e.kind === 'new_address')
      return (
        <>
          <button type="button" className="p-btn" disabled={merge.isPending} onClick={() => merge.mutate(ev(e), { onSuccess: () => toastOk('Merged') })}>
            <Icon name="merge" size={16} />
            Same device, merge
          </button>
          <button type="button" className="p-btn" disabled={markOk.isPending} onClick={() => markOk.mutate(ev(e))}>
            Different device
          </button>
        </>
      )
    const kid = kidOf(e)
    return (
      <>
        {kid && (
          <>
            <button type="button" className="p-btn" onClick={() => openChat('private', String(kid.id))}>
              <Icon name="chat" size={16} />
              Ask {kid.name}
            </button>
            <button
              type="button"
              className="p-btn"
              data-variant="red"
              disabled={lockKid.isPending}
              onClick={() => lockKid.mutate({ kidId: kid.id, action: 'lock' }, { onSuccess: () => toastOk(`Locked all ${kid.name}'s devices`) })}
            >
              <Icon name="lock" size={16} />
              Lock all {kid.name}&apos;s devices
            </button>
          </>
        )}
        {!e.reviewed && (
          <button type="button" className="p-btn" disabled={markOk.isPending} onClick={() => markOk.mutate(ev(e))}>
            Mark OK
          </button>
        )}
      </>
    )
  }

  const shown = [...data.days].reverse()
  const max = Math.max(1, ...shown.map((d) => d.online_minutes))

  return (
    <div className="pk-grid">
      <div className="da-kpis pk-span">
        {KPIS.map(([k, label, short]) => (
          <div key={k} className="da-kpi" data-hi={(k === 'bypass' && data.counts[k] > 0) || undefined}>
            <span className="da-long">{label}</span>
            <span className="da-short">{short}</span>
            <b>{data.counts[k] ?? 0}</b>
          </div>
        ))}
      </div>

      <section className="pk-panel pk-span" aria-label="Attempts & alerts">
        <h3 className="da-h3">
          <Icon name="policy" size={18} />
          Attempts &amp; alerts
          <span className="da-filt" role="group" aria-label="Filter">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </span>
        </h3>
        {events.length === 0 ? (
          <EmptyState
            icon="verified_user"
            tone="acc"
            title="No attempts this week"
            body={`${device.name} hasn't tried to get around the lock or go online outside hours.`}
          />
        ) : (
          <ul className="da-list">
            {events.map((e) => {
              const t = eventText(e, device.name, timeZone)
              return (
                <li key={e.id} className="da-al" data-reviewed={e.reviewed || undefined}>
                  <span className="da-sev" data-sev={t.sev}>
                    <Icon name={t.icon} size={18} />
                  </span>
                  <div className="da-t">
                    {t.title}
                    <span className="da-w">{whenLabel(e.at, timeZone, now)}</span>
                    <small>{t.sub}</small>
                    <div className="da-acts">{actions(e)}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="pk-panel" aria-label="Time online per day">
        <h3>
          <Icon name="bar_chart" size={18} />
          Time online per day
        </h3>
        <div className="da-bars">
          {shown.map((d) => (
            <div key={d.date} className="da-bar-slot">
              <div className="da-bar" title={duration(d.online_minutes)} style={{ height: `max(2px, ${(d.online_minutes / max) * 100}%)` }} />
            </div>
          ))}
        </div>
        <div className="da-bl">
          {shown.map((d, i) => (
            <span key={d.date}>{i === shown.length - 1 ? 'Today' : weekday(d.date)}</span>
          ))}
        </div>
      </section>

      <LockHistory history={data.history} timeZone={timeZone} now={now} />
    </div>
  )
}
