import { useExpired } from '@/v2/hooks/useDevices'
import { Chip } from '@/v2/parent/Chip'
import { Icon } from '@/v2/parent/Icon'
import type { Device } from '@/v2/types'
import { inFamilyZone } from './deviceMeta'
import { whyText } from './activityText'

const clock = (iso: string, tz?: string) => inFamilyZone(iso, tz, { timeStyle: 'short' })

/** Device Overview "Right now": state, why, when it locks, and any manual override. */
export function DeviceRightNow({ device, timeZone }: { device: Device; timeZone?: string }) {
  // an override that ran out while the screen was open no longer counts
  const expired = useExpired(device.override?.expires_at)
  const ov = expired ? null : device.override
  const state =
    device.status === 'guest' ? (['grey', 'person', 'Guest'] as const)
    : device.online ? (['acc', 'lock_open', 'Open'] as const)
    : (['red', 'lock', 'Locked'] as const)
  const verb = ov?.action === 'lock' ? 'Locked' : 'Unlocked'
  const override = !ov ? 'None · on schedule' : ov.expires_at ? `${verb} until ${clock(ov.expires_at, timeZone)}` : verb
  const why = whyText(device)
  return (
    <section className="pk-panel" aria-label="Right now">
      <h3>
        <Icon name="bolt" size={18} />
        Right now
      </h3>
      <div className="pk-kv">
        <span>State</span>
        <Chip tone={state[0]} icon={state[1]}>{state[2]}</Chip>
      </div>
      {why && (
        <div className="pk-kv">
          <span>Why</span>
          <b>{why}</b>
        </div>
      )}
      {device.locks_at && (
        <div className="pk-kv">
          <span>Locks at</span>
          <b>{clock(device.locks_at, timeZone)}</b>
        </div>
      )}
      <div className="pk-kv">
        <span>Override</span>
        <b>{override}</b>
      </div>
    </section>
  )
}
