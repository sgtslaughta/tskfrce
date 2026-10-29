import { describe, test, expect } from '@jest/globals'
import { clock, kidChips, kidSort, nextStep, stepBadge, stepChip, stepHint, tally } from '@/v2/kid/kidChips'
import type { KidChore, KidStep } from '@/v2/types'

const NOW = Date.parse('2026-10-26T21:30:00Z')
const TZ = 'America/New_York'
const mk = (o: Partial<KidChore> = {}): KidChore => ({ id: 1, title: 'x', points: 5, state: 'todo', ...o })
const labels = (c: KidChore, little = false) => kidChips(c, NOW, TZ, little).map((x) => x.label)
const step = (o: Partial<KidStep> = {}): KidStep => ({ id: 1, title: 's', done: false, ...o })

describe('kidChips', () => {
  test('overdue', () => {
    const c = mk({ due_at: '2026-10-26T21:00:00Z' })
    expect(labels(c)).toEqual(['Overdue'])
    expect(labels(c, true)).toEqual(['Late!'])
  })
  test('due within the hour', () => {
    const c = mk({ due_at: '2026-10-26T21:50:00Z' })
    expect(labels(c)).toEqual(['Due in 20 min'])
    expect(labels(c, true)).toEqual(['Hurry · 20 min'])
  })
  test('due later today uses the family zone', () => {
    const c = mk({ due_at: '2026-10-26T23:30:00Z' })
    expect(labels(c)).toEqual(['Due 7:30'])
    expect(labels(c, true)).toEqual(['By 7:30'])
    expect(kidChips(c, NOW, 'America/New_York', false, true)[0].label).toBe('Due 7:30 PM') // Teen keeps AM/PM
  })
  test('times follow the given zone, not the device', () => {
    const c = mk({ due_at: '2026-10-26T23:30:00Z' })
    expect(kidChips(c, NOW, 'UTC')[0].label).toBe('Due 11:30')
    expect(kidChips(c, NOW, 'Asia/Tokyo')[0].label).toBe('Due 8:30')
    expect(clock('2026-10-26T23:30:00Z', 'Asia/Tokyo')).toBe('8:30 AM')
  })
  test('invalid zone falls back without throwing', () => {
    expect(() => clock('2026-10-26T23:30:00Z', 'Not/AZone')).not.toThrow()
  })
  test('sent back comes first', () => {
    expect(labels(mk({ sent_back: true, due_at: '2026-10-26T21:00:00Z' }))[0]).toBe('Sent back')
  })
  test('new + due later', () => {
    expect(labels(mk({ new: true, due_at: '2026-10-26T23:30:00Z' }))).toEqual(['New', 'Due 7:30'])
  })
  test('needs_you, done, skipped', () => {
    expect(labels(mk({ state: 'needs_you', due_at: '2026-10-26T21:00:00Z' }))).toEqual(['Waiting for OK'])
    expect(labels(mk({ state: 'done' }))).toEqual(['Approved'])
    expect(labels(mk({ state: 'done' }), true)).toEqual(['Done'])
    expect(labels(mk({ state: 'skipped' }))).toEqual([])
  })
  test('no deadline, nothing new', () => {
    expect(labels(mk())).toEqual([])
  })
})

describe('steps', () => {
  const steps = [step({ id: 1 }), step({ id: 2, after_previous: true }), step({ id: 3, after_previous: true, locked: true, due_at: '2026-10-26T22:00:00Z' }), step({ id: 4 })]
  test('badge', () => expect(steps.map((_, i) => stepBadge(steps, i))).toEqual(['1', '2', '3', '–']))
  test('nextStep', () => {
    expect(nextStep(steps)).toBe(0)
    expect(nextStep([step({ done: true }), step({ locked: true })])).toBe(-1)
  })
  test('hint locked', () => expect(stepHint(steps, 2, TZ)).toBe('Unlocks after step 2 · by 6:00 PM'))
  test('hint locked with no earlier undone step', () => {
    expect(stepHint([step({ locked: true })], 0, TZ)).toBe('Locked')
  })
  test('hint next / any time / done', () => {
    expect(stepHint(steps, 0, TZ)).toBe('Do this next')
    expect(stepHint(steps, 3, TZ)).toBe('Any time')
    expect(stepHint([step({ done: true, done_at: '2026-10-26T21:00:00Z' })], 0, TZ)).toBe('Done at 5:00 PM')
  })
  test('stepChip', () => {
    expect(stepChip(step({ done: true, due_at: '2026-10-26T21:00:00Z' }), NOW, TZ)).toBeNull()
    expect(stepChip(step(), NOW, TZ)).toBeNull()
    expect(stepChip(step({ due_at: '2026-10-26T21:00:00Z' }), NOW, TZ)?.tone).toBe('late')
    expect(stepChip(step({ due_at: '2026-10-26T22:00:00Z' }), NOW, TZ)).toEqual({ tone: 'soon', time: '6:00' })
    expect(stepChip(step({ due_at: '2026-10-26T23:30:00Z' }), NOW, TZ)?.tone).toBe('later')
  })
})

describe('list helpers', () => {
  const list = [
    mk({ id: 1, state: 'done' }),
    mk({ id: 2, state: 'needs_you' }),
    mk({ id: 3, due_at: '2026-10-26T23:00:00Z' }),
    mk({ id: 4, due_at: '2026-10-26T20:00:00Z' }),
    mk({ id: 5 }),
  ]
  test('kidSort', () => expect(kidSort(list, NOW).map((c) => c.id)).toEqual([4, 3, 5, 2, 1]))
  test('tally ignores skipped', () => {
    expect(tally([...list, mk({ id: 6, state: 'skipped' })])).toEqual({ approved: 1, total: 5, todo: 3, waiting: 1 })
    expect(tally([])).toEqual({ approved: 0, total: 0, todo: 0, waiting: 0 })
  })
})
