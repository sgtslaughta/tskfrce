import { useEffect, useState } from 'react'
import { Chip, Drawer } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { Device, Kid } from '@/v2/types'
import { DeviceRow } from './DeviceRow'

const FILTERS: { status: Device['status']; label: string; empty: string }[] = [
  { status: 'unassigned', label: 'New', empty: 'No new devices. When a phone or laptop joins your Wi-Fi, it shows up here.' },
  { status: 'assigned', label: 'Assigned', empty: 'No assigned devices yet. Give a new device an owner and it moves here.' },
  { status: 'guest', label: 'Guests', empty: 'No guest devices. Guests are always online and have no owner.' },
]

const icon = (name: string) =>
  /phone|pixel|galaxy|ipad|tablet|android/i.test(name) ? '📱' : /tv|roku|xbox|playstation|switch|console/i.test(name) ? '🎮' : '💻'

export function DevicesSection({ devices, kids, focus }: { devices: Device[]; kids: Kid[]; focus: number }) {
  const small = useMediaQuery('(max-width: 767px)')
  const [filter, setFilter] = useState<Device['status'] | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [handled, setHandled] = useState(false)
  const count = (s: Device['status']) => devices.filter((d) => d.status === s).length
  const target = devices.find((d) => d.id === focus)

  // ?focus=<id>: open that device once the list has loaded.
  useEffect(() => {
    if (target && !handled) {
      setHandled(true)
      setFilter(target.status)
      setOpenId(target.id)
    }
  }, [target, handled])

  const cur = filter ?? FILTERS.find((f) => count(f.status) > 0)?.status ?? 'unassigned'
  const def = FILTERS.find((f) => f.status === cur) ?? FILTERS[0]
  const rows = devices.filter((d) => d.status === cur)
  const opened = devices.find((d) => d.id === openId)

  return (
    <>
      <h2 className="f-display">Devices</h2>
      <div className="f-card m-info">
        The home box pauses internet for normal use on your Wi‑Fi. It can&apos;t stop a determined kid who changes
        network settings, uses a phone hotspot, or swaps devices — but it will tell you when a paused device is getting
        around the block.
      </div>
      <Chip.Group value={cur} onChange={(v) => setFilter(v as Device['status'])}>
        <div className="f-row">
          {FILTERS.map((f) => (
            <Chip key={f.status} value={f.status}>
              {f.label} <span className="m-num">{count(f.status)}</span>
            </Chip>
          ))}
        </div>
      </Chip.Group>
      {rows.length === 0 && <p className="m-empty">{def.empty}</p>}
      {rows.length > 0 && (
        <div className="f-card m-list">
          {rows.map((d) => (
            <button key={d.id} type="button" className="m-row" onClick={() => setOpenId(d.id)}>
              <span>
                {icon(d.name)} <b style={{ display: 'inline' }}>{d.name}</b>
                <span className="m-meta">
                  <span className="m-dot" data-on={d.online || undefined} role="img" aria-label={d.online ? 'online' : 'offline'} />
                  {d.vendor ?? 'Unknown maker'}
                  {d.resisting ? ' · getting around the block' : ''}
                </span>
              </span>
              <span className="m-avs">
                {d.owner_ids.map((id) => {
                  const k = kids.find((x) => x.id === id)
                  return (
                    <span key={id} className="m-av" title={k?.full_name ?? k?.username}>
                      {k?.avatar || (k?.full_name ?? k?.username ?? '?')[0]}
                    </span>
                  )
                })}
              </span>
              <span className="m-mode">{FILTERS.find((f) => f.status === d.status)?.label}</span>
            </button>
          ))}
        </div>
      )}
      <Drawer opened={!!opened} onClose={() => setOpenId(null)} position="right" size={small ? '100%' : 'md'} title={opened?.name ?? 'Device'}>
        {opened && <DeviceRow key={opened.id} device={opened} kids={kids} focused={opened.id === focus} onDone={() => setOpenId(null)} />}
      </Drawer>
    </>
  )
}
