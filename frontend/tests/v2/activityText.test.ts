import { describe, expect, test } from '@jest/globals'
import { eventText, historyText, slotRuns, whenLabel, whyText } from '@/v2/manage/activityText'
import type { Device, DeviceEvent } from '@/v2/types'

const ev = (o: Partial<DeviceEvent>): DeviceEvent => ({
  id: 1, kind: 'bypass', at: '2026-10-26T20:00:00Z', last_at: null, count: 1, reason: null, kid_id: null,
  kid_name: null, by_name: null, other_device_id: null, other_device_name: null, minutes: null, detail: '',
  reviewed: false, ...o,
})

describe('eventText', () => {
  test('bypass', () => {
    const t = eventText(ev({ last_at: '2026-10-26T20:12:00Z', minutes: 12 }), 'iPad')
    expect(t).toMatchObject({ icon: 'gpp_maybe', sev: 'hi', title: 'Got around the lock for 12 min' })
    expect(t.sub).toContain('The box re-locked it.')
    expect(eventText(ev({}), 'iPad').title).toBe('Getting around the lock now')
  })
  test('new_address', () => {
    const t = eventText(ev({ kind: 'new_address', other_device_name: 'Unknown', minutes: 3 }), 'iPad')
    expect(t.title).toBe('New address right after locking')
    expect(t.sub).toBe('A “new device” named Unknown joined 3 min after this device locked. Likely a private MAC switch to dodge the lock.')
  })
  test('outside_hours', () => {
    expect(eventText(ev({ kind: 'outside_hours', count: 1 }), 'x')).toMatchObject({ icon: 'schedule', sev: 'md', title: 'Tried to get online outside allowed hours' })
    expect(eventText(ev({ kind: 'outside_hours', count: 1 }), 'x').sub).toMatch(/^1 try at .+\. It hit the lock page\.$/)
    expect(eventText(ev({ kind: 'outside_hours', count: 4, last_at: '2026-10-26T20:30:00Z' }), 'x').sub).toMatch(/^4 tries between .+ and .+\. Each try hit the lock page\.$/)
  })
  test('left_wifi', () => {
    const t = eventText(ev({ kind: 'left_wifi', minutes: 5 }), 'x')
    expect(t.title).toBe('Left Wi-Fi while locked')
    expect(t.sub).toBe("Dropped off the home network 5 min after locking. May have used mobile data or a hotspot; the box can't see that traffic.")
  })
  test('sign_in', () => {
    expect(eventText(ev({ kind: 'sign_in', count: 3, kid_name: 'Mia' }), 'Switch')).toMatchObject({
      icon: 'pin', title: '3 wrong PIN tries on Mia’s sign-in, from this device', sub: 'Someone on Switch tried to sign in as Mia.',
    })
    expect(eventText(ev({ kind: 'sign_in', count: 1, kid_name: 'Mia' }), 'x').title).toBe('1 wrong PIN try on Mia’s sign-in, from this device')
  })
  test('locked_try', () => {
    expect(eventText(ev({ kind: 'locked_try', reason: 'chores', count: 6 }), 'x')).toMatchObject({
      icon: 'block', sev: 'lo', title: 'Tried to get online while locked (chores not done)', sub: '6 tries',
    })
    expect(eventText(ev({ kind: 'locked_try', reason: 'manual' }), 'x').title).toContain('locked by a parent')
    expect(eventText(ev({ kind: 'locked_try', reason: 'new_device' }), 'x').title).toContain('new device')
  })
})

describe('historyText', () => {
  test.each([
    [{ kind: 'locked', reason: 'schedule' }, 'lock', 'Locked by schedule'],
    [{ kind: 'locked', reason: 'chores' }, 'lock', 'Locked: chores not done'],
    [{ kind: 'locked', reason: 'manual', by_name: 'Dad' }, 'lock', 'Locked by Dad'],
    [{ kind: 'locked', reason: 'new_device' }, 'lock', 'Locked: new device'],
    [{ kind: 'unlocked', reason: 'manual', by_name: 'Dad', minutes: 30 }, 'lock_open', 'Unlocked 30 min by Dad'],
    [{ kind: 'unlocked', reason: 'manual', by_name: 'Dad' }, 'lock_open', 'Unlocked by Dad'],
    [{ kind: 'unlocked', reason: 'chores' }, 'task_alt', 'Opened: chores done'],
    [{ kind: 'unlocked', reason: 'schedule' }, 'lock_open', 'Opened by schedule'],
    [{ kind: 'unlocked', reason: 'free_time' }, 'lock_open', 'Opened: free time'],
    [{ kind: 'unlocked', reason: 'bonus' }, 'lock_open', 'Opened: screen time'],
    [{ kind: 'unlocked', reason: 'exempt' }, 'verified_user', 'Opened: always allowed'],
    [{ kind: 'unlocked', reason: 'guest' }, 'lock_open', 'Opened: marked as guest'],
    [{ kind: 'unlocked', reason: 'unassigned' }, 'lock_open', 'Opened: new devices allowed'],
  ])('%j', (o, icon, title) => expect(historyText(ev(o as Partial<DeviceEvent>))).toEqual({ icon, title }))
})

describe('whyText', () => {
  const d = (o: Partial<Device>) => ({ online: true, reason: null, chores_done: 0, chores_total: 0, ...o }) as Device
  test.each([
    [{ online: false, reason: 'chores', chores_done: 3, chores_total: 5 }, 'Chores 3/5 done'],
    [{ online: true, reason: 'chores' }, 'Chores done'],
    [{ online: false, reason: 'schedule' }, 'Outside allowed hours'],
    [{ online: true, reason: 'schedule' }, 'No chores to wait for'],
    [{ online: false, reason: 'manual' }, 'Locked by a parent'],
    [{ online: true, reason: 'manual' }, 'Unlocked by a parent'],
    [{ online: false, reason: 'new_device' }, 'New device, waiting for you'],
    [{ reason: 'free_time' }, 'Free time'],
    [{ reason: 'bonus' }, 'Screen time'],
    [{ reason: 'guest' }, 'Guest, never blocked'],
    [{ reason: 'exempt' }, 'Always allowed'],
    [{ reason: 'unassigned' }, 'New device, allowed until you assign it'],
  ])('%j', (o, out) => expect(whyText(d(o as Partial<Device>))).toBe(out))
})

describe('slotRuns', () => {
  test('groups consecutive slots into percent runs', () => {
    const r = slotRuns('oo..ll' + '.'.repeat(138))
    expect(r).toHaveLength(2)
    expect(r[0].state).toBe('o')
    expect(r[0].from).toBeCloseTo(0)
    expect(r[0].to).toBeCloseTo(1.389, 2)
    expect(r[1].state).toBe('l')
    expect(r[1].from).toBeCloseTo(2.778, 2)
    expect(r[1].to).toBeCloseTo(4.167, 2)
  })
})

describe('whenLabel', () => {
  const now = Date.parse('2026-10-26T18:00:00Z') // Mon 2:00 PM New York
  const tz = 'America/New_York'
  test('today', () => expect(whenLabel('2026-10-26T15:04:00Z', tz, now)).toBe('Today 11:04 AM'))
  test('yesterday', () => expect(whenLabel('2026-10-26T00:00:00Z', tz, now)).toBe('Yesterday 8:00 PM'))
  test('within a week', () => expect(whenLabel('2026-10-21T13:14:00Z', tz, now)).toBe('Wed 9:14 AM'))
  test('older', () => expect(whenLabel('2026-10-12T20:03:00Z', tz, now)).toBe('Oct 12, 4:03 PM'))
})
