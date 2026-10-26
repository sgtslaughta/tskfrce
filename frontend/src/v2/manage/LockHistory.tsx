import { Icon } from '@/v2/parent/Icon'
import type { DeviceEvent } from '@/v2/types'
import { historyText, whenLabel } from './activityText'

/** Activity tab "Lock history": locked / opened rows, newest first. */
export function LockHistory({ history, timeZone, now }: { history: DeviceEvent[]; timeZone?: string; now: number }) {
  return (
    <section className="pk-panel da-log" aria-label="Lock history">
      <h3>
        <Icon name="history" size={18} />
        Lock history
      </h3>
      {history.length === 0 ? (
        <p className="pk-hint pk-empty">No locks yet.</p>
      ) : (
        history.map((e) => {
          const t = historyText(e)
          return (
            <div key={e.id} className="pk-kv">
              <span>
                <Icon name={t.icon} size={16} />
                {t.title}
              </span>
              <b>{whenLabel(e.at, timeZone, now)}</b>
            </div>
          )
        })
      )}
    </section>
  )
}
