import { Skeleton } from '@/v2/parent/states'
import { Icon } from '@/v2/parent/Icon'
import type { Device } from '@/v2/types'
import { useDeviceActivity } from '@/v2/hooks/useDeviceActivity'
import { slotRuns } from './activityText'

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })

/** Overview "Online this week": one 24 h bar per day (online / locked), newest first. */
export function OnlineWeek({ device }: { device: Device }) {
  const { data, isLoading } = useDeviceActivity(device.id)
  const days = data?.days ?? []
  return (
    <section className="pk-panel pk-span" aria-label="Online this week">
      <h3>
        <Icon name="timeline" size={18} />
        Online this week
      </h3>
      {isLoading ? (
        <Skeleton rows={1} />
      ) : (
        <>
          <ul className="ow">
            {days.map((d, i) => (
              <li key={d.date} className="ow-row">
                <span>{i === 0 ? 'Today' : weekday(d.date)}</span>
                <div className="ow-track">
                  {slotRuns(d.slots).map((r, j) => (
                    <b key={j} data-state={r.state} style={{ left: `${r.from}%`, width: `${r.to - r.from}%` }} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="ow-ax" aria-hidden="true">
            {['12a', '6a', '12p', '6p', '12a'].map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
          <div className="ph-legend">
            <span><i className="ow-key" data-state="o" />Online</span>
            <span><i className="ow-key" data-state="l" />Locked</span>
            <span><i className="ow-key" />Offline</span>
          </div>
        </>
      )}
    </section>
  )
}
