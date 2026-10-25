import { statusChip } from '@/v2/today/statusChip'

const due = '2026-10-25T18:00:00Z'
const t = Date.parse(due)
const MIN = 60000
const todo = { state: 'todo' as const, due_at: due }
const labels = (c: Parameters<typeof statusChip>[0], now: number) => statusChip(c, now).map((x) => x.label)

describe('statusChip', () => {
  it('overdue one minute past due', () => {
    expect(statusChip(todo, t + MIN)[0]).toEqual({ tone: 'red', icon: 'alarm', label: 'Overdue' })
  })
  it('due soon within the hour', () => {
    expect(statusChip(todo, t - 20 * MIN)[0]).toEqual({ tone: 'amb', icon: 'hourglass_bottom', label: 'Due in 20 min' })
  })
  it('to do when over 60 min away or no deadline', () => {
    expect(labels(todo, t - 61 * MIN)).toEqual(['To do'])
    expect(labels({ state: 'todo', due_at: null }, t)).toEqual(['To do'])
  })
  it('sent back beats overdue', () => {
    expect(labels({ ...todo, sent_back: true }, t + MIN)).toEqual(['Sent back'])
  })
  it('state chips', () => {
    expect(labels({ state: 'done' }, t)).toEqual(['Approved'])
    expect(labels({ state: 'needs_you' }, t)).toEqual(['Needs OK'])
    expect(labels({ state: 'skipped' }, t)).toEqual(['Skipped'])
  })
  it('note then deduction follow the state chip', () => {
    const note = { label: 'Need help', text: null, at: due, kid_name: 'Sam' }
    expect(labels({ ...todo, note, deducted: 10 }, t - 90 * MIN)).toEqual(['To do', 'Note', '−10'])
  })
})
