import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { api, KID_TOKEN_KEY } from '@/v2/api'
import { fridgeTheme } from '@/v2/theme'
import { KidPage } from '@/v2/kid/KidPage'
import { KidEditor } from '@/v2/manage/KidEditor'
import { authService } from '@/services/authService'
import { apiPost } from '@/services/api'

jest.mock('@/v2/api', () => ({ ...(jest.requireActual('@/v2/api') as object), api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('@/services/api', () => ({ apiPost: jest.fn(), apiGet: jest.fn() }))

const apiMock = api as unknown as Mock<(p: string, i?: unknown) => Promise<unknown>>
const wrap = (ui: unknown) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MantineProvider theme={fridgeTheme}>{ui as never}</MantineProvider>
  </QueryClientProvider>
)

beforeEach(() => {
  localStorage.clear()
  apiMock.mockReset()
  window.matchMedia ??= ((() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never)
})

describe('authService.login messages', () => {
  const fail = (status_code: number, detail = 'x') => (apiPost as unknown as Mock<() => Promise<never>>).mockRejectedValue({ status_code, detail } as never)
  test.each([
    [401, "That username and password don't match."],
    [400, "That username and password don't match."],
    [429, 'Too many tries. Wait a minute and try again.'],
    [403, 'Account disabled'],
  ])('%i', async (code, msg) => {
    fail(code, 'Account disabled')
    await expect(authService.login({ username: 'a', password: 'b' })).rejects.toThrow(msg)
  })
})

test('KidEditor rejects a PIN that is not 4 digits', async () => {
  render(wrap(<KidEditor />))
  await userEvent.type(screen.getByLabelText(/Name/), 'Zed')
  await userEvent.type(screen.getByLabelText(/PIN/), '12')
  expect(screen.getByText('Use exactly 4 digits.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add kid' })).toBeDisabled()
})

test('kid name survives a reload on a shared device', async () => {
  const kids = [
    { id: 1, full_name: 'Ana', avatar: null, has_pin: false },
    { id: 2, full_name: 'Ben', avatar: null, has_pin: false },
  ]
  apiMock.mockImplementation(async (p) =>
    p === '/kid/whoami'
      ? { device: { id: 1, name: 'iPad' }, kids }
      : p === '/kid/login'
        ? { access_token: 'tok' }
        : p === '/profiles'
          ? []
          : p === '/leaderboard'
            ? { week_start: '2026-01-05', rows: [] }
          : { locked: true, points_balance: 0, chores: [] },
  )
  const first = render(wrap(<KidPage />))
  await userEvent.click(await screen.findByRole('button', { name: /Ben/ }))
  await screen.findByRole('heading', { name: 'Hi Ben!' })
  expect(localStorage.getItem(KID_TOKEN_KEY)).toBe('tok')
  first.unmount()
  render(wrap(<KidPage />))
  expect(await screen.findByRole('heading', { name: 'Hi Ben!' })).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
})
