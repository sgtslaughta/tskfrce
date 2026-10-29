import { Chip } from '@/v2/parent/Chip'
import { useBlocker } from '@/v2/hooks/useDevices'
import { Icon } from '@/v2/parent/Icon'
import type { Device } from '@/v2/types'
import { inFamilyZone } from './deviceMeta'
import { isPrivateMac } from './privateMac'

const maskMac = (mac: string) => (mac.length < 17 ? mac : mac.substring(0, 6) + '••:••' + mac.substring(11))

/** Network tab: addresses and connection history. */
export function DeviceNetwork({ device, timeZone }: { device: Device; timeZone?: string }) {
  const boxUp = useBlocker().data?.online
  const hold = boxUp === false ? (['grey', 'wifi_off', 'Box offline'] as const) : device.resisting ? (['amb', 'warning', 'Slipping'] as const) : boxUp ? (['acc', 'shield', 'Healthy'] as const) : null
  return (
    <div className="pk-grid">
      <section className="pk-panel" aria-label="Addresses">
        <h3>
          <Icon name="lan" size={18} />
          Addresses
        </h3>
        {device.ip && (
          <div className="pk-kv">
            <span>IPv4</span>
            <b className="pk-mono">{device.ip}</b>
          </div>
        )}
        {device.ipv6 && device.ipv6.length > 0 && (
          <div className="pk-kv">
            <span>IPv6</span>
            <b className="pk-mono">
              {device.ipv6.map((ip) => (
                <div key={ip}>{ip}</div>
              ))}
            </b>
          </div>
        )}
        <div className="pk-kv">
          <span>MAC</span>
          <b className="pk-mono">{maskMac(device.mac)}</b>
        </div>
        {isPrivateMac(device.mac) && (
          <div className="pk-kv">
            <span>Private MAC</span>
            <Chip tone="amb" icon="wifi">
              Yes, random
            </Chip>
          </div>
        )}
        {device.hostname && (
          <div className="pk-kv">
            <span>Hostname</span>
            <b className="pk-mono">{device.hostname}</b>
          </div>
        )}
        <div className="pk-kv">
          <span>Maker</span>
          <b>{device.vendor ?? 'Unknown'}</b>
        </div>
      </section>
      <section className="pk-panel" aria-label="Connection">
        <h3>
          <Icon name="router" size={18} />
          Connection
        </h3>
        <div className="pk-kv">
          <span>Status</span>
          <Chip tone={device.online ? 'acc' : 'grey'} icon={device.online ? 'wifi' : 'wifi_off'}>{device.online ? 'Online' : 'Offline'}</Chip>
        </div>
        {device.first_seen && (
          <div className="pk-kv">
            <span>First seen</span>
            <b>{inFamilyZone(device.first_seen, timeZone, { dateStyle: 'medium' })}</b>
          </div>
        )}
        {device.last_seen && (
          <div className="pk-kv">
            <span>Last seen</span>
            <b>{inFamilyZone(device.last_seen, timeZone)}</b>
          </div>
        )}
        {hold && (
          <div className="pk-kv">
            <span>Blocker hold</span>
            <Chip tone={hold[0]} icon={hold[1]}>{hold[2]}</Chip>
          </div>
        )}
        <div className="pk-kv">
          <span>Resisting blocker</span>
          <b>{device.resisting ? 'Yes' : 'No'}</b>
        </div>
        {device.address_changes !== undefined && (
          <div className="pk-kv">
            <span>Address changes (7 days)</span>
            <b>{device.address_changes}</b>
          </div>
        )}
      </section>
      {isPrivateMac(device.mac) && (
        <section className="pk-panel pk-span" data-tone="amber" aria-label="Private MAC tip">
          <h3>
            <Icon name="shield" size={18} />
            Private MAC is on
          </h3>
          <p className="pk-hint">
            This device can switch to a new random address, which would look like a new device. Turn off &ldquo;Private Wi-Fi Address&rdquo; for your
            home network on it so the lock keeps working.
          </p>
        </section>
      )}
    </div>
  )
}
