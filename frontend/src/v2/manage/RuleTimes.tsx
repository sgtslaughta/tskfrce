import { Icon } from '@/v2/parent/Icon'

export type Range = { start: string; end: string }
const MAX = 6 // backend limit

/** "{start} to {end}" rows with ×, "Add another time", and an overnight hint per row. */
export function RuleTimes({ label, times, onChange }: { label: string; times: Range[]; onChange: (t: Range[]) => void }) {
  const set = (i: number, patch: Partial<Range>) => onChange(times.map((t, j) => (j === i ? { ...t, ...patch } : t)))
  return (
    <div className="pk-field" role="group" aria-label={label}>
      <span className="pk-label">{label}</span>
      {times.map((t, i) => (
        <div key={i} className="ph-tw-wrap">
          <div className="ph-tw">
            <span className="ph-fi">
              <Icon name="schedule" size={18} />
              <input type="time" aria-label={`Start ${i + 1}`} value={t.start} required onChange={(e) => set(i, { start: e.currentTarget.value })} />
            </span>
            <span>to</span>
            <span className="ph-fi">
              <input type="time" aria-label={`End ${i + 1}`} value={t.end} required onChange={(e) => set(i, { end: e.currentTarget.value })} />
            </span>
            <button type="button" className="pk-ib" aria-label={`Remove time ${i + 1}`} title="Remove" disabled={times.length === 1} onClick={() => onChange(times.filter((_, j) => j !== i))}>
              <Icon name="close" size={18} />
            </button>
          </div>
          {t.start && t.end && t.end < t.start && <span className="pk-hint">Ends the next morning</span>}
        </div>
      ))}
      {times.length < MAX && (
        <button type="button" className="ph-addt" onClick={() => onChange([...times, { start: '15:00', end: '20:00' }])}>
          <Icon name="add" size={18} />
          Add another time
        </button>
      )}
    </div>
  )
}
