import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { api } from '@/v2/api'
import { choreSub, ChoreRow } from '@/v2/today/ChoreRow'
import type { TodayChore, TodayKid } from '@/v2/types'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))

const apiMock = api as unknown as Mock<(p: string, i?: unknown) => Promise<unknown>>
const kid = { id: 1, name: 'Mia', chores: [], devices: [] } as unknown as TodayKid
const base: TodayChore = {
  id: 11,
  title: 'Clean bathroom',
  points: 10,
  state: 'todo',
  due_at: '2020-01-01T17:00:00Z',
  type: { id: 1, name: 'Cleaning', glyph: 'cleaning_services' },
  can_move: true,
}
const note = { label: 'Out of supplies', text: 'No more toilet spray', at: '2020-01-01T17:12:00Z', kid_name: 'Mia' }

const row = (c: TodayChore) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>
        <ChoreRow chore={c} kid={kid} isOpen={false} onToggle={() => undefined} />
      </MantineProvider>
    </QueryClientProvider>,
  )

beforeEach(() => apiMock.mockReset().mockResolvedValue({ timezone: 'UTC' }))

describe('ChoreRow', () => {
  test('overdue row shows Overdue and the type glyph', () => {
    row(base)
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('cleaning_services')).toBeInTheDocument()
  })

  test('a generic Other type glyph falls back to the title guess, like the profile and chat', () => {
    row({ ...base, title: 'Dishes', type: { id: 3, name: 'Other', glyph: 'task_alt' } })
    expect(screen.getByText('restaurant')).toBeInTheDocument()
  })

  test('a done chore reads Done <time> · approved', () => {
    expect(choreSub({ ...base, state: 'done', done_at: '2026-10-20T17:40:00Z' }, () => '5:40 PM')).toBe('Done 5:40 PM · approved')
  })

  test('sub-line counts photos and messages', () => {
    expect(choreSub({ ...base, photos: 2, messages: 1 })).toMatch(/2 photos · 1 message$/)
    expect(choreSub({ ...base, photos: 1 })).toMatch(/1 photo$/)
  })

  test('note card shows label and text, with Reply, Move and Skip', () => {
    row({ ...base, note })
    expect(screen.getByText(/Mia: Out of supplies · “No more toilet spray”/)).toBeInTheDocument()
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move to tomorrow/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip today \(no penalty\)/i })).toBeInTheDocument()
  })

  test('Move is hidden when tomorrow already has the chore', () => {
    row({ ...base, note, can_move: false })
    expect(screen.queryByRole('button', { name: /move to tomorrow/i })).toBeNull()
    expect(screen.getByRole('button', { name: /skip today/i })).toBeInTheDocument()
  })

  test('a deduction strikes the points and adds a −N chip', () => {
    row({ ...base, state: 'done', deducted: 10, due_at: null })
    expect(screen.getByText('−10')).toBeInTheDocument()
    expect(screen.getByText('+10').tagName).toBe('S')
  })
})
