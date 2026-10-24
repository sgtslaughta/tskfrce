import { useState } from 'react'
import { HeaderChips } from '@/v2/parent/HeaderChips'
import { Chip } from '@/v2/parent/Chip'
import { Icon } from '@/v2/parent/Icon'
import { SegmentedControl } from '@/v2/parent/SegmentedControl'
import { isPrivateMac } from './privateMac'
import type { Device, Kid, Group } from '@/v2/types'

type HeaderChip = { text: string; vendor?: string; icon?: string; tone?: 'acc' | 'mono' | 'plain' }

interface Props {
  device: Device
  kids: Kid[]
  groups?: Group[]
  isGroupOpen: boolean
  onClose: () => void
  onRequestOverride: (req: { kind: string; id: number; action: string }) => void
}

const maskMac = (mac: string) => {
  if (mac.length < 17) return mac
  return mac.substring(0, 6) + '••:••' + mac.substring(11)
}

const relativeTime = (iso: string | null) => {
  if (!iso) return 'never'
  const date = new Date(iso)
  const now = new Date()
  const ms = now.getTime() - date.getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const ownerName = (kids: Kid[], ownerIds: number[]) => {
  if (ownerIds.length === 0) return 'Unassigned'
  return kids
    .filter((k) => ownerIds.includes(k.id))
    .map((k) => k.full_name || k.username)
    .join(', ')
}

export function DeviceDetail({ device, kids, groups, isGroupOpen, onClose, onRequestOverride }: Props) {
  const [tab, setTab] = useState<string | null>('overview')

  const headerChips: HeaderChip[] = [
    ...(device.vendor ? [{ text: device.vendor, vendor: device.vendor, icon: 'package' }] : []),
    {
      text: device.online ? 'Online now' : `Last seen ${relativeTime(device.last_seen)}`,
      tone: device.online ? ('acc' as const) : ('plain' as const),
      icon: device.online ? 'wifi' : 'clock',
    },
    ...(device.ip ? [{ text: device.ip, tone: 'mono' as const, icon: 'lan' }] : []),
    { text: ownerName(kids, device.owner_ids), icon: 'person' },
  ]

  return (
    <div className="p-detail-column p-grid" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 600, color: 'var(--p-ink)' }}>
          {device.name}
        </h2>
        <HeaderChips items={headerChips} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="p-btn" data-variant="red" onClick={() => onRequestOverride({ kind: 'device', id: device.id, action: 'lock' })}>
          <Icon name="lock" size={16} />
          Lock now
        </button>
        <button className="p-btn" onClick={() => onRequestOverride({ kind: 'device', id: device.id, action: 'unlock' })}>
          <Icon name="lock_open" size={16} />
          Unlock 30 min
        </button>
      </div>

      <SegmentedControl
        value={tab || 'overview'}
        onChange={setTab}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'network', label: 'Network' },
        ]}
      />

      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' }}>
          <div className="p-card" style={{ padding: 16, borderRadius: 16, border: '1px solid var(--p-line)', backgroundColor: 'var(--p-soft)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 600, color: 'var(--p-ink)' }}>
              Details
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--p-sub)', marginBottom: 4 }}>
                  Name
                </label>
                <div style={{ padding: '8px 12px', background: 'var(--p-card)', border: '1px solid var(--p-line)', borderRadius: 8, fontSize: 13, color: 'var(--p-ink)' }}>
                  {device.name}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--p-sub)', marginBottom: 4 }}>
                  Owners
                </label>
                <div style={{ padding: '8px 12px', background: 'var(--p-card)', border: '1px solid var(--p-line)', borderRadius: 8, fontSize: 13, color: 'var(--p-ink)' }}>
                  {ownerName(kids, device.owner_ids)}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--p-sub)', marginBottom: 4 }}>
                  Groups
                </label>
                <div style={{ padding: '8px 12px', background: 'var(--p-card)', border: '1px solid var(--p-line)', borderRadius: 8, fontSize: 13, color: 'var(--p-ink)' }}>
                  {groups
                    ?.filter((g) => device.group_ids.includes(g.id))
                    .map((g) => g.name)
                    .join(', ') || '—'}
                </div>
              </div>
              <div style={{ paddingTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--p-ink)', fontWeight: 500 }}>
                  <input type="checkbox" checked={device.status === 'guest'} disabled style={{ width: 16, height: 16 }} />
                  Guest
                </label>
              </div>
            </div>
          </div>

          <div className="p-card" style={{ padding: 16, borderRadius: 16, border: '1px solid var(--p-line)', backgroundColor: 'var(--p-soft)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 600, color: 'var(--p-ink)' }}>
              Right now
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--p-sub)', marginBottom: 4 }}>
                  Status
                </label>
                <div style={{ fontSize: 13, color: 'var(--p-ink)' }}>
                  {device.status === 'guest' ? 'Guest' : device.online ? 'Online' : 'Offline'}
                </div>
              </div>
              {device.override && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--p-sub)', marginBottom: 4 }}>
                    Override
                  </label>
                  <div style={{ fontSize: 13, color: 'var(--p-ink)' }}>{device.override.action}</div>
                </div>
              )}
              {device.override?.expires_at && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--p-sub)', marginBottom: 4 }}>
                    Expires at
                  </label>
                  <div style={{ fontSize: 13, color: 'var(--p-ink)' }}>
                    {new Date(device.override.expires_at).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'network' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' }}>
          {device.ip && (
            <div className="p-card" style={{ padding: 12, borderRadius: 8, border: '1px solid var(--p-line)', backgroundColor: 'var(--p-soft)' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--p-sub)', marginBottom: 4 }}>
                IPv4
              </label>
              <div style={{ fontSize: 13, color: 'var(--p-ink)', fontFamily: 'monospace' }}>{device.ip}</div>
            </div>
          )}
          {device.ipv6 && device.ipv6.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--p-sub)', marginBottom: 4 }}>
                IPv6
              </label>
              {device.ipv6.map((ip, i) => (
                <div key={i} className="p-card" style={{ padding: 12, borderRadius: 8, border: '1px solid var(--p-line)', backgroundColor: 'var(--p-soft)', marginBottom: 4, fontSize: 13, color: 'var(--p-ink)', fontFamily: 'monospace' }}>
                  {ip}
                </div>
              ))}
            </div>
          )}
          <div className="p-card" style={{ padding: 12, borderRadius: 8, border: '1px solid var(--p-line)', backgroundColor: 'var(--p-soft)' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--p-sub)', marginBottom: 4 }}>
              MAC
            </label>
            <div style={{ fontSize: 13, color: 'var(--p-ink)', fontFamily: 'monospace' }}>{maskMac(device.mac)}</div>
          </div>
          {isPrivateMac(device.mac) && (
            <Chip tone="amb" icon="wifi">
              Yes, random
            </Chip>
          )}
          {device.hostname && (
            <div className="p-card" style={{ padding: 12, borderRadius: 8, border: '1px solid var(--p-line)', backgroundColor: 'var(--p-soft)' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--p-sub)', marginBottom: 4 }}>
                Hostname
              </label>
              <div style={{ fontSize: 13, color: 'var(--p-ink)' }}>{device.hostname}</div>
            </div>
          )}
          {device.first_seen && (
            <div className="p-card" style={{ padding: 12, borderRadius: 8, border: '1px solid var(--p-line)', backgroundColor: 'var(--p-soft)' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--p-sub)', marginBottom: 4 }}>
                First seen
              </label>
              <div style={{ fontSize: 13, color: 'var(--p-ink)' }}>
                {new Date(device.first_seen).toLocaleDateString()}
              </div>
            </div>
          )}
          {device.last_seen && (
            <div className="p-card" style={{ padding: 12, borderRadius: 8, border: '1px solid var(--p-line)', backgroundColor: 'var(--p-soft)' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--p-sub)', marginBottom: 4 }}>
                Last seen
              </label>
              <div style={{ fontSize: 13, color: 'var(--p-ink)' }}>
                {new Date(device.last_seen).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
