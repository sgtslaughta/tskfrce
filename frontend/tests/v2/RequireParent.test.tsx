import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cancelSignOut, markSetupDone, RequireParent, startSignOut } from '@/v2/components/RequireParent'
import { api } from '@/v2/api'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'

const replace = jest.fn()
jest.mock('next/router', () => ({ useRouter: () => ({ replace, asPath: '/devices?x=1' }) }))
jest.mock('@/v2/api', () => ({ api: jest.fn(), KID_TOKEN_KEY: 'task4ce-kid-token', CANT_REACH: "Can't reach the home box. Check it's plugged in and on Wi-Fi." }))
jest.mock('@/contexts/UnifiedAuthContext', () => ({ useUnifiedAuth: jest.fn() }))

const apiMock = api as unknown as Mock<(p: string) => Promise<unknown>>
const authMock = useUnifiedAuth as unknown as Mock<() => unknown>

const auth = (over: object) =>
  authMock.mockReturnValue({ isInitialized: true, isAuthenticated: true, user: { role: 'parent' }, ...over })

let client: QueryClient
const renderGuard = () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <RequireParent>
        <p>secret</p>
      </RequireParent>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  replace.mockReset()
  apiMock.mockReset().mockResolvedValue({ needed: false })
})

describe('RequireParent', () => {
  test('setup needed sends to /setup', async () => {
    apiMock.mockResolvedValue({ needed: true })
    auth({ isAuthenticated: false, user: null })
    renderGuard()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/setup'))
    expect(apiMock).toHaveBeenCalledWith('/setup')
    expect(screen.queryByText('secret')).toBeNull()
  })

  test('logged out sends to /login with next', async () => {
    auth({ isAuthenticated: false, user: null })
    renderGuard()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=%2Fdevices%3Fx%3D1'))
  })

  test('a kid device (kid token, no parent login) gets the "for parents" panel, then /kid', async () => {
    localStorage.setItem('task4ce-kid-token', 'k')
    auth({ isAuthenticated: false, user: null })
    renderGuard()
    expect(await screen.findByText('This part is for parents')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Go now/ }))
    expect(replace).toHaveBeenCalledWith('/kid')
    expect(replace).not.toHaveBeenCalledWith(expect.stringContaining('/login'))
    localStorage.removeItem('task4ce-kid-token')
  })

  test('kid sends to /kid', async () => {
    auth({ user: { role: 'kid' } })
    renderGuard()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/kid'))
    expect(screen.queryByText('secret')).toBeNull()
  })

  test('parent sees children', async () => {
    auth({})
    renderGuard()
    expect(await screen.findByText('secret')).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  test('no redirect while auth is still loading', async () => {
    auth({ isInitialized: false, isAuthenticated: false, user: null })
    renderGuard()
    expect(await screen.findByRole('status')).toBeTruthy()
    await waitFor(() => expect(apiMock).toHaveBeenCalled())
    expect(replace).not.toHaveBeenCalled()
  })

  test('setup check failure shows a retry message', async () => {
    apiMock.mockRejectedValueOnce(new TypeError('down')).mockResolvedValue({ needed: false })
    auth({})
    renderGuard()
    expect(await screen.findByText("Can't reach your home box")).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('secret')).toBeTruthy()
  })

  test('markSetupDone stops the /setup redirect', async () => {
    apiMock.mockResolvedValue({ needed: true })
    auth({})
    renderGuard()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/setup'))
    act(() => markSetupDone(client))
    expect(await screen.findByText('secret')).toBeTruthy()
  })
})

describe('RequireParent states', () => {
  const route = (map: Record<string, unknown>) =>
    apiMock.mockImplementation(async (p) => {
      const v = map[p]
      if (v instanceof Error) throw v
      return v
    })

  test('an unfinished setup sends the parent to /setup with the resume panel', async () => {
    route({ '/setup': { needed: false }, '/setup/step': { step: 5 } })
    auth({})
    renderGuard()
    expect(await screen.findByText("Let's finish setting up")).toBeTruthy()
    expect(screen.getByText('Taking you to setup, step 5 of 7…')).toBeTruthy()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/setup'))
    expect(screen.queryByText('secret')).toBeNull()
  })

  test('a finished setup (no saved step) shows the page', async () => {
    route({ '/setup': { needed: false }, '/setup/step': { step: null } })
    auth({})
    renderGuard()
    expect(await screen.findByText('secret')).toBeTruthy()
  })

  test('a 502 from the proxy right away means the box is starting, and it keeps retrying', async () => {
    jest.useFakeTimers({ advanceTimers: true })
    route({ '/setup': Object.assign(new Error('bad gateway'), { status: 502 }) })
    auth({})
    renderGuard()
    expect(await screen.findByText('Starting your home box')).toBeTruthy()
    const before = apiMock.mock.calls.length
    await act(async () => void jest.advanceTimersByTime(3100))
    await waitFor(() => expect(apiMock.mock.calls.length).toBeGreaterThan(before))
    route({ '/setup': { needed: false }, '/setup/step': { step: null } })
    await act(async () => void jest.advanceTimersByTime(3100))
    expect(await screen.findByText('secret')).toBeTruthy()
    jest.useRealTimers()
  })

  test('signing out shows the sign-out state, and a failed sign-out brings the page back', async () => {
    auth({})
    renderGuard()
    expect(await screen.findByText('secret')).toBeTruthy()
    act(() => startSignOut())
    expect(await screen.findByText('Signing you out…')).toBeTruthy()
    expect(screen.queryByText('secret')).toBeNull()
    act(() => cancelSignOut())
    expect(await screen.findByText('secret')).toBeTruthy()
  })
})

// last: startSignOut is module state
test('after startSignOut a logged-out guard goes to plain /login', async () => {
  startSignOut()
  auth({ isAuthenticated: false, user: null })
  renderGuard()
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
})
