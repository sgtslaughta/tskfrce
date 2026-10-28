/** Shared clock text: "4:30 PM", and "midnight" for 12:00 AM (00:00 / 24:00). */
const HM = { hour: 'numeric', minute: '2-digit' } as const

function clean(iso: string | Date, tz: string | undefined, opts: Intl.DateTimeFormatOptions) {
  const d = new Date(iso)
  try {
    return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz }).formatToParts(d)
  } catch {
    return new Intl.DateTimeFormat('en-US', opts).formatToParts(d) // bad zone name: browser zone
  }
}

/** Time of an instant in `tz` (browser zone when missing). `short` drops AM/PM ("4:30"). */
export function clockText(iso: string | Date, tz?: string, short = false): string {
  const p = Object.fromEntries(clean(iso, tz, { ...HM, hourCycle: 'h23' }).map((x) => [x.type, x.value]))
  if (+p.hour === 0 && +p.minute === 0) return 'midnight'
  const h = +p.hour % 12 || 12
  return `${h}:${p.minute}${short ? '' : ` ${+p.hour < 12 ? 'AM' : 'PM'}`}`
}

/** "20:30" → "8:30 PM"; "00:00" / "24:00" → "midnight". */
export function wallClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (m === 0 && (h === 0 || h === 24)) return 'midnight'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h % 24 < 12 ? 'AM' : 'PM'}`
}

/** Whole calendar days from `iso` to `now` in the browser zone (0 = same day, 1 = yesterday). */
export function daysAgo(iso: string | Date, now = new Date()): number {
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  return Math.round((day(now) - day(new Date(iso))) / 86400000)
}
