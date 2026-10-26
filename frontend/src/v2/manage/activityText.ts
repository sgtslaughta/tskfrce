import type { Device, DeviceEvent } from '@/v2/types'

type Sev = 'hi' | 'md' | 'lo'

const time = (iso: string, tz?: string) => {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })
  } catch {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
}

const LOCKED_WHY: Record<string, string> = { chores: 'chores not done', manual: 'locked by a parent', new_device: 'new device' }

/** Alert row copy for the Activity tab. */
export function eventText(e: DeviceEvent, deviceName: string): { icon: string; sev: Sev; title: string; sub: string } {
  const kid = e.kid_name ?? 'a kid'
  switch (e.kind) {
    case 'bypass':
      return {
        icon: 'gpp_maybe',
        sev: 'hi',
        title: e.last_at ? `Got around the lock for ${e.minutes ?? 0} min` : 'Getting around the lock now',
        sub: 'Kept reaching the internet while locked: the lock was being dodged (often a manual network setting or VPN). The box re-locked it.',
      }
    case 'new_address':
      return {
        icon: 'swap_horiz',
        sev: 'md',
        title: 'New address right after locking',
        sub: `A “new device” named ${e.other_device_name ?? 'unknown'} joined ${e.minutes ?? 0} min after this device locked. Likely a private MAC switch to dodge the lock.`,
      }
    case 'outside_hours':
      return {
        icon: 'schedule',
        sev: 'md',
        title: 'Tried to get online outside allowed hours',
        sub:
          e.count === 1 || !e.last_at
            ? `${e.count} ${e.count === 1 ? 'try' : 'tries'} at ${time(e.at)}. ${e.count === 1 ? 'It hit' : 'Each try hit'} the lock page.`
            : `${e.count} tries between ${time(e.at)} and ${time(e.last_at)}. Each try hit the lock page.`,
      }
    case 'left_wifi':
      return {
        icon: 'wifi_off',
        sev: 'md',
        title: 'Left Wi-Fi while locked',
        sub: `Dropped off the home network ${e.minutes ?? 0} min after locking. May have used mobile data or a hotspot; the box can't see that traffic.`,
      }
    case 'sign_in':
      return {
        icon: 'pin',
        sev: 'md',
        title: `${e.count} wrong PIN ${e.count === 1 ? 'try' : 'tries'} on ${kid}’s sign-in, from this device`,
        sub: `Someone on ${deviceName} tried to sign in as ${kid}.`,
      }
    default:
      return {
        icon: 'block',
        sev: 'lo',
        title: `Tried to get online while locked (${LOCKED_WHY[e.reason ?? ''] ?? 'locked'})`,
        sub: `${e.count} ${e.count === 1 ? 'try' : 'tries'}`,
      }
  }
}

const OPENED: Record<string, [string, string]> = {
  chores: ['task_alt', 'Opened: chores done'],
  schedule: ['lock_open', 'Opened by schedule'],
  free_time: ['lock_open', 'Opened: free time'],
  bonus: ['lock_open', 'Opened: screen time'],
  exempt: ['verified_user', 'Opened: always allowed'],
  guest: ['lock_open', 'Opened: marked as guest'],
  unassigned: ['lock_open', 'Opened: new devices allowed'],
}

/** Lock / unlock history row copy. */
export function historyText(e: DeviceEvent): { icon: string; title: string } {
  const by = e.by_name ?? 'a parent'
  if (e.kind === 'locked') {
    const title =
      e.reason === 'chores' ? 'Locked: chores not done'
      : e.reason === 'manual' ? `Locked by ${by}`
      : e.reason === 'new_device' ? 'Locked: new device'
      : 'Locked by schedule'
    return { icon: 'lock', title }
  }
  if (e.reason === 'manual') return { icon: 'lock_open', title: e.minutes ? `Unlocked ${e.minutes} min by ${by}` : `Unlocked by ${by}` }
  const [icon, title] = OPENED[e.reason ?? ''] ?? ['lock_open', 'Opened']
  return { icon, title }
}

/** One-line reason a device is blocked or open right now. */
export function whyText(d: Device): string {
  const blocked = !d.online
  switch (d.reason) {
    case 'chores': return blocked ? `Chores ${d.chores_done}/${d.chores_total} done` : 'Chores done'
    case 'schedule': return blocked ? 'Outside allowed hours' : 'No chores to wait for'
    case 'manual': return blocked ? 'Locked by a parent' : 'Unlocked by a parent'
    case 'new_device': return 'New device, waiting for you'
    case 'free_time': return 'Free time'
    case 'bonus': return 'Screen time'
    case 'guest': return 'Guest, never blocked'
    case 'exempt': return 'Always allowed'
    case 'unassigned': return 'New device, allowed until you assign it'
    default: return ''
  }
}

function parts(ms: number, tz: string | undefined, opts: Intl.DateTimeFormatOptions): Record<string, string> {
  let f: Intl.DateTimeFormat
  try {
    f = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz })
  } catch {
    f = new Intl.DateTimeFormat('en-US', opts)
  }
  return Object.fromEntries(f.formatToParts(ms).map((p) => [p.type, p.value]))
}

const dayNum = (ms: number, tz?: string) => {
  const p = parts(ms, tz, { year: 'numeric', month: 'numeric', day: 'numeric' })
  return Date.UTC(+p.year, +p.month - 1, +p.day) / 86_400_000
}

/** "Today 3:04 PM" / "Yesterday 8:00 PM" / "Tue 9:14 PM" / "Oct 12, 4:03 PM" in the family zone. */
export function whenLabel(iso: string, tz: string | undefined, nowMs: number): string {
  const ms = new Date(iso).getTime()
  const t = parts(ms, tz, { hour: 'numeric', minute: '2-digit', hour12: true })
  const clock = `${t.hour}:${t.minute} ${t.dayPeriod}`
  const diff = dayNum(nowMs, tz) - dayNum(ms, tz)
  if (diff === 0) return `Today ${clock}`
  if (diff === 1) return `Yesterday ${clock}`
  if (diff > 1 && diff < 7) return `${parts(ms, tz, { weekday: 'short' }).weekday} ${clock}`
  const d = parts(ms, tz, { month: 'short', day: 'numeric' })
  return `${d.month} ${d.day}, ${clock}`
}

/** Runs of online/locked 10-minute slots, as percent of the day. */
export function slotRuns(slots: string): { state: 'o' | 'l'; from: number; to: number }[] {
  const runs: { state: 'o' | 'l'; from: number; to: number }[] = []
  const pct = (i: number) => (i / slots.length) * 100
  let i = 0
  while (i < slots.length) {
    const c = slots[i]
    let j = i + 1
    while (j < slots.length && slots[j] === c) j++
    if (c === 'o' || c === 'l') runs.push({ state: c, from: pct(i), to: pct(j) })
    i = j
  }
  return runs
}
