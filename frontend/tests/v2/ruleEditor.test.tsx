import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fridgeTheme } from '@/v2/theme'
import { api } from '@/v2/api'
import { RuleEditor } from '@/v2/manage/RuleEditor'
import type { HourRule, RuleBody } from '@/v2/types'

jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@/v2/hooks/useKids', () => ({
  useKids: () => ({ data: [{ id: 2, username: 'mia', full_name: 'Mia' }, { id: 3, username: 'leo', full_name: 'Leo' }] }),
}))
jest.mock('@/v2/hooks/useDevices', () => ({ useGroups: () => ({ data: [{ id: 1, name: 'Game consoles', device_ids: [] }] }) }))

const apiMock = api as unknown as Mock<(p: string, init?: { method?: string; body?: unknown }) => Promise<unknown>>
const calls = (method: string) => apiMock.mock.calls.filter(([, i]) => i?.method === method)

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never
})
beforeEach(() => {
  apiMock.mockReset().mockResolvedValue({})
})

const editor = (p: { rule?: HourRule; initial?: Partial<RuleBody> }) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider theme={fridgeTheme}>
        <RuleEditor opened onClose={jest.fn()} {...p} />
      </MantineProvider>
    </QueryClientProvider>,
  )

const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed')

describe('RuleEditor', () => {
  test('picking School nights turns on Sun to Thu', async () => {
    editor({ initial: { category: 'other' } })
    await userEvent.click(await screen.findByRole('button', { name: 'School nights' }))
    expect(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'].map(pressed)).toEqual(['true', 'true', 'true', 'true', 'true'])
    expect(['Friday', 'Saturday'].map(pressed)).toEqual(['false', 'false'])
  })

  test('a holiday without dates cannot be saved', async () => {
    editor({ initial: { category: 'holiday' } })
    await userEvent.type(await screen.findByLabelText('Name'), 'Winter break')
    expect(screen.getByText('Holidays and summer need a first and last day.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  test('Save posts the rule with two kids and one group', async () => {
    editor({ initial: { category: 'other' } })
    expect(await screen.findByText('Add hours')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Name'), 'Game time')
    await userEvent.click(screen.getByRole('switch', { name: 'Everyone' }))
    for (const n of ['Mia', 'Leo', 'Game consoles']) await userEvent.click(screen.getByRole('button', { name: n }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual([
        '/hours',
        {
          method: 'POST',
          body: {
            name: 'Game time', category: 'other', kind: 'allowed', days: '0123456', times: [{ start: '15:00', end: '20:00' }],
            everyone: false, kid_ids: [2, 3], group_ids: [1], start_date: null, end_date: null,
          },
        },
      ]),
    )
  })

  test('edit mode sends PUT to /hours/{id}', async () => {
    const rule: HourRule = {
      id: 5, name: 'Weekends', category: 'weekend', kind: 'allowed', days: '45', start_date: null, end_date: null,
      everyone: true, kid_ids: [], group_ids: [], times: [{ start: '08:00', end: '22:00' }],
    }
    editor({ rule })
    expect(await screen.findByText('Edit hours')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const { id: _id, ...body } = rule
    await waitFor(() => expect(calls('PUT')[0]).toEqual(['/hours/5', { method: 'PUT', body }]))
  })
})
