import { expect, test } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { HoursTimeline, daysLabel, segments } from '@/v2/manage/HoursTimeline'

test('overnight windows split into two bars; equal ends mean all day', () => {
  expect(segments('16:00', '20:00')).toEqual([[(16 / 24) * 100, (20 / 24) * 100]])
  expect(segments('22:00', '02:00')).toEqual([[(22 / 24) * 100, 100], [0, (2 / 24) * 100]])
  expect(segments('07:00', '07:00')).toEqual([[0, 100]])
})

test('days read like a person would say them', () => {
  expect(daysLabel('0123456')).toBe('Every day')
  expect(daysLabel('01234')).toBe('Weekdays')
  expect(daysLabel('65')).toBe('Weekends')
  expect(daysLabel('024')).toBe('M W F')
})

test('rows name the kid and days; an overnight window draws two bars', () => {
  const kids = [{ id: 2, full_name: 'Bobby', username: 'bobby' }] as never
  const w = { id: 1, kind: 'allowed', days: '01234', start: '18:00', end: '02:00', kid_id: 2, group_id: null }
  const { container } = render(<HoursTimeline windows={[w] as never} kids={kids} groups={[]} />)
  expect(screen.getByText('Bobby · Allowed · Weekdays')).toBeInTheDocument()
  expect(container.querySelectorAll('.timeline-bar')).toHaveLength(2)
})
