import { describe, expect, jest, test } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HoursTimeline } from '@/v2/manage/HoursTimeline'
import type { Group, HourRule, Kid } from '@/v2/types'

const kids = [
  { id: 2, username: 'mia', full_name: 'Mia' },
  { id: 3, username: 'leo', full_name: 'Leo' },
] as Kid[]
const groups = [{ id: 1, name: 'Game consoles', device_ids: [] }] as unknown as Group[]

const rule = (o: Partial<HourRule>): HourRule => ({
  id: 1, name: 'r', category: 'other', kind: 'allowed', days: '0123456', start_date: null, end_date: null,
  everyone: true, kid_ids: [], group_ids: [], times: [{ start: '15:00', end: '20:00' }], ...o,
})

const rules = [
  rule({ id: 1, name: 'Mia only', everyone: false, kid_ids: [2], category: 'school_night', days: '01236' }),
  rule({ id: 2, name: 'Consoles', everyone: false, group_ids: [1] }),
  rule({ id: 3, name: 'Winter break', category: 'holiday', start_date: '2026-12-20', end_date: '2027-01-03' }),
  rule({ id: 4, name: 'Weekends', category: 'weekend', days: '45', times: [{ start: '08:00', end: '22:00' }] }),
  rule({ id: 5, name: 'School nights', category: 'school_night', days: '01236', times: [{ start: '06:00', end: '08:00' }, { start: '15:00', end: '20:00' }] }),
  rule({ id: 6, name: 'Homework', kind: 'off', everyone: false, kid_ids: [3], days: '0123' }),
]

describe('HoursTimeline', () => {
  test('one row per rule in sortRules order, pencils call onEdit', async () => {
    const onEdit = jest.fn()
    render(<HoursTimeline rules={rules} kids={kids} groups={groups} onEdit={onEdit} />)
    const pencils = screen.getAllByRole('button', { name: /^Edit / })
    expect(pencils.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Edit School nights', 'Edit Weekends', 'Edit Winter break', 'Edit Consoles', 'Edit Mia only', 'Edit Homework',
    ])
    await userEvent.click(screen.getByRole('button', { name: 'Edit Weekends' }))
    expect(onEdit).toHaveBeenCalledWith(rules[3])
  })

  test('kid rule shows its initial; sub line is who and days or dates; bars carry kind and range', () => {
    const { container } = render(<HoursTimeline rules={rules} kids={kids} groups={groups} />)
    expect(screen.getByText('M')).toHaveClass('avx')
    expect(screen.getByText('Mia · Sun–Thu')).toBeInTheDocument()
    expect(screen.getByText('Everyone · Dec 20 – Jan 3')).toBeInTheDocument()
    expect(screen.getByText('Everyone · Fri–Sat')).toBeInTheDocument()
    expect(screen.getByText('6–8a')).toBeInTheDocument()
    expect(container.querySelector('[data-kind="off"]')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull()
    for (const t of ['12a', '6a', '12p', '6p']) expect(screen.getAllByText(t).length).toBeGreaterThan(0)
  })

  test('an overnight time draws two bars', () => {
    const { container } = render(<HoursTimeline rules={[rule({ times: [{ start: '22:00', end: '02:00' }] })]} kids={kids} groups={groups} />)
    expect(container.querySelectorAll('[data-kind="allowed"]')).toHaveLength(2)
  })

  test('empty state', () => {
    render(<HoursTimeline rules={[]} kids={kids} groups={groups} />)
    expect(screen.getByText('No hours yet. Devices can be online any time until you add some.')).toBeInTheDocument()
  })

  test('empty state inside a group does not claim devices are unrestricted', () => {
    render(<HoursTimeline rules={[]} kids={kids} groups={groups} thisGroup />)
    expect(screen.getByText("No hours just for this group. Each kid's own hours still apply.")).toBeInTheDocument()
  })
})
