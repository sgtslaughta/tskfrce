import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SetupPage from '../../pages/setup'
import { api, ApiError } from '@/v2/api'
import { fridgeTheme } from '@/v2/theme'
import { DEFAULT_DRAFTS } from '@/v2/setup/StepHours'

const replace = jest.fn()
const push = jest.fn()
jest.mock('next/router', () => ({ useRouter: () => ({ push, replace, asPath: '/setup' }) }))
jest.mock('@/v2/api', () => {
  class ApiError extends Error {
    status: number
    detail: string
    constructor(status: number, detail: string) {
      super(detail)
      this.status = status
      this.detail = detail
    }
  }
  return { api: jest.fn(), ApiError }
})
const loginWithToken = jest.fn()
jest.mock('@/contexts/UnifiedAuthContext', () => ({ useUnifiedAuth: () => ({ loginWithToken }) }))

const apiMock = api as unknown as Mock<(p: string, i?: { method?: string }) => Promise<unknown>>

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MantineProvider theme={fridgeTheme}>
        <SetupPage />
      </MantineProvider>
    </QueryClientProvider>,
  )

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) as unknown as MediaQueryList)
  window.ResizeObserver = window.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {})
})

beforeEach(() => {
  apiMock.mockReset().mockImplementation(async (path, init) => {
    if (path === '/setup' && init?.method === 'POST') return { access_token: 't', refresh_token: 'r', expires_in: 1800 }
    if (path === '/setup') return { needed: true }
    if (path === '/devices') return []
    if (path === '/chores/') return { id: 31 }
    if (path === '/kids') return { id: 7, full_name: 'Ava', username: 'kid-ava', avatar: '🦊', has_pin: false }
    return {}
  })
  replace.mockReset()
  push.mockReset()
  loginWithToken.mockReset()
})

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

async function toParent(user: ReturnType<typeof userEvent.setup>) {
  // Step 1: Parent account (Your name, Username, Password)
  await user.type(screen.getByLabelText('Your name'), 'Sam')
  await user.type(screen.getByLabelText('Username'), 'sam')
  // Password will be typed by caller
}

/** Parent step 1, then the family step; the next Next click creates the account. */
async function toFamily(user: ReturnType<typeof userEvent.setup>) {
  await toParent(user)
  await user.type(screen.getByLabelText(/^Password/), 'longenough1')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await user.type(await screen.findByLabelText('Family name'), 'The Sams')
}

describe('setup wizard', () => {
  test('step 1 renders parent account form', () => {
    wrap()
    expect(screen.getByLabelText('Your name')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
  })

  test('parent form has username and password fields', () => {
    wrap()
    expect(screen.getByLabelText('Your name')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  test('short password blocks Next', async () => {
    const user = userEvent.setup()
    wrap()
    await toParent(user)
    await user.type(screen.getByLabelText(/^Password/), 'short')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument()
    expect(apiMock).not.toHaveBeenCalledWith('/setup', expect.objectContaining({ method: 'POST' }))
  })

  test('409 shows the log in link', async () => {
    apiMock.mockImplementation(async (path, init) => {
      if (path === '/setup' && init?.method === 'POST') throw new ApiError(409, 'Setup is already done. Log in instead.')
      return { needed: true }
    })
    const user = userEvent.setup()
    wrap()
    await toFamily(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    const link = await screen.findByRole('link', { name: 'Log in' })
    expect(link).toHaveAttribute('href', '/login')
  })

  test('skipping steps 3 to 6 reaches Finish', async () => {
    const user = userEvent.setup()
    wrap()
    await toFamily(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(loginWithToken).toHaveBeenCalledWith('t', 'r', 1800))
    for (let i = 0; i < 5; i++) await user.click(await screen.findByRole('button', { name: 'Skip' }))
    await user.click(await screen.findByRole('button', { name: 'Finish' }))
    expect(push).toHaveBeenCalledWith('/')
    expect(replace).not.toHaveBeenCalled()
  })

  const finishAccount = async (user: ReturnType<typeof userEvent.setup>) => {
    await toFamily(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByLabelText('Name')
  }
  const posts = (path: string) =>
    apiMock.mock.calls.filter(([p, i]) => p === path && i?.method === 'POST')

  test('empty family name blocks Next; the account POST carries the family name and time zone', async () => {
    const user = userEvent.setup()
    wrap()
    await toParent(user)
    await user.type(screen.getByLabelText(/^Password/), 'longenough1')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(await screen.findByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Enter a family name.')).toBeInTheDocument()
    expect(posts('/setup')).toHaveLength(0)
    await user.type(screen.getByLabelText('Family name'), 'The Sams')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByLabelText('Name')
    expect(posts('/setup')[0][1]).toEqual({
      method: 'POST',
      body: { family_name: 'The Sams', timezone: tz, parent: { username: 'sam', password: 'longenough1', full_name: 'Sam' } },
    })
  })

  test('already set up redirects to /login', async () => {
    apiMock.mockImplementation(async () => ({ needed: false }))
    wrap()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
  })

  test('login failure after setup shows a log in link and never re-posts', async () => {
    loginWithToken.mockImplementation(() => Promise.reject(new Error('nope')))
    const user = userEvent.setup()
    wrap()
    await toFamily(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText(/Your account was created/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(posts('/setup')).toHaveLength(1)
  })

  test('kids, chores and bedtime post exact bodies once, even after Back and Next', async () => {
    const user = userEvent.setup()
    wrap()
    await finishAccount(user)
    await user.type(screen.getByLabelText('Name'), 'Ava')
    await user.click(screen.getByRole('button', { name: 'Add kid' }))
    await screen.findByText(/Ava/)
    expect(posts('/kids')[0][1]).toEqual({ method: 'POST', body: { full_name: 'Ava', avatar: '🦊', pin: null } })
    await user.click(screen.getByRole('button', { name: 'Next' })) // Step 3 → 4 (Chores)
    await user.click(await screen.findByLabelText('Make bed'))
    await user.click(screen.getByRole('button', { name: 'Next' })) // Step 4 → 5 (Devices)
    expect(await screen.findByText('No devices yet — you can add them later from Devices.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' })) // Step 5 → 6 (Hours)
    await screen.findByText('Allowed hours')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(await screen.findByRole('button', { name: 'Next' }))
    await user.click(await screen.findByRole('button', { name: 'Next' }))
    await user.click(await screen.findByRole('button', { name: 'Next' }))
    await user.click(await screen.findByRole('button', { name: 'Finish' }))
    expect(posts('/chores/')).toHaveLength(1)
    expect(posts('/chores/')[0][1]).toEqual({
      method: 'POST',
      body: { title: 'Make bed', points: 10, needs_photo: false, steps: [] },
    })
    expect(posts('/chores/31/assignments')).toHaveLength(1)
    expect(posts('/chores/31/assignments')[0][1]).toEqual({
      method: 'POST',
      body: { kid_ids: [7], mode: 'each', repeat: { type: 'daily', days: [] }, on_date: null, due_time: null },
    })
    expect(posts('/hours')).toHaveLength(2) // posted once on the way past, never again
  })

  const toHours = async (user: ReturnType<typeof userEvent.setup>) => {
    await finishAccount(user)
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Skip' }))
    await screen.findByText('Allowed hours')
  }
  const rowText = (name: string) => screen.getByRole('button', { name: `Edit ${name}` }).parentElement!.textContent

  test('step 6 shows the default rules and bedtime edits the range', async () => {
    const user = userEvent.setup()
    wrap()
    await toHours(user)
    expect(rowText('School nights')).toContain('6–8a')
    expect(rowText('School nights')).toContain('3–8p')
    expect(rowText('Weekends')).toContain('8a–10p')
    expect(screen.getByLabelText('Bedtime on school nights')).toHaveValue('20:00')
    fireEvent.change(screen.getByLabelText('Bedtime on weekends'), { target: { value: '23:00' } })
    expect(rowText('Weekends')).toContain('8a–11p')
  })

  test('Next posts both rules for everyone and PATCHes chores_lock', async () => {
    const user = userEvent.setup()
    wrap()
    await toHours(user)
    await user.click(screen.getByRole('switch', { name: "Lock until today's chores are done" }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Reach it from anywhere')
    const bodies = posts('/hours').map(([, i]) => (i as { body: Record<string, unknown> }).body)
    expect(bodies.map((b) => b.name)).toEqual(['School nights', 'Weekends'])
    expect(bodies[0]).toEqual({
      name: 'School nights', category: 'school_night', kind: 'allowed', days: '01236', everyone: true,
      kid_ids: [], group_ids: [], start_date: null, end_date: null,
      times: [{ start: '06:00', end: '08:00' }, { start: '15:00', end: '20:00' }],
    })
    expect(bodies[1]).toMatchObject({ category: 'weekend', days: '45', everyone: true, times: [{ start: '08:00', end: '22:00' }] })
    expect(apiMock).toHaveBeenCalledWith('/family', { method: 'PATCH', body: { chores_lock: false } })
  })

  test('a rule already on the server is not posted again', async () => {
    const base = apiMock.getMockImplementation()!
    apiMock.mockImplementation(async (path, init) =>
      path === '/hours' && !init?.method ? { today: null, rules: [{ id: 5, ...DEFAULT_DRAFTS[0] }] } : base(path, init),
    )
    const user = userEvent.setup()
    wrap()
    await toHours(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Reach it from anywhere')
    expect(posts('/hours').map(([, i]) => (i as { body: { name: string } }).body.name)).toEqual(['Weekends'])
  })

  test('a server rule with the same name but a different body does not suppress the post', async () => {
    const base = apiMock.getMockImplementation()!
    apiMock.mockImplementation(async (path, init) =>
      path === '/hours' && !init?.method ? { today: null, rules: [{ id: 5, ...DEFAULT_DRAFTS[0], days: '0123456' }] } : base(path, init),
    )
    const user = userEvent.setup()
    wrap()
    await toHours(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Reach it from anywhere')
    expect(posts('/hours').map(([, i]) => (i as { body: { name: string } }).body.name)).toEqual(['School nights', 'Weekends'])
  })

  test('a typed but unadded kid name blocks Next', async () => {
    const user = userEvent.setup()
    wrap()
    await finishAccount(user)
    await user.type(screen.getByLabelText('Name'), 'Ben')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Add Ben first or clear the field.')).toBeInTheDocument()
  })
})
