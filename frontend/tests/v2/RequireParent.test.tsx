import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RequireParent } from '@/v2/components/RequireParent'
import { api } from '@/v2/api'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'

const push = jest.fn()
jest.mock('next/router', () => ({ useRouter: () => ({ push, asPath: '/devices?x=1' }) }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@/contexts/UnifiedAuthContext', () => ({ useUnifiedAuth: jest.fn() }))

const apiMock = api as unknown as Mock<(p: string) => Promise<unknown>>
const authMock = useUnifiedAuth as unknown as Mock<() => unknown>

const auth = (over: object) =>
  authMock.mockReturnValue({ isInitialized: true, isAuthenticated: true, user: { role: 'parent' }, ...over })

const renderGuard = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RequireParent>
        <p>secret</p>
      </RequireParent>
    </QueryClientProvider>,
  )

beforeEach(() => {
  push.mockReset()
  apiMock.mockReset().mockResolvedValue({ needed: false })
})

describe('RequireParent', () => {
  test('setup needed sends to /setup', async () => {
    apiMock.mockResolvedValue({ needed: true })
    auth({ isAuthenticated: false, user: null })
    renderGuard()
    await waitFor(() => expect(push).toHaveBeenCalledWith('/setup'))
    expect(apiMock).toHaveBeenCalledWith('/setup')
    expect(screen.queryByText('secret')).toBeNull()
  })

  test('logged out sends to /login with next', async () => {
    auth({ isAuthenticated: false, user: null })
    renderGuard()
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login?next=%2Fdevices%3Fx%3D1'))
  })

  test('kid sends to /kid', async () => {
    auth({ user: { role: 'kid' } })
    renderGuard()
    await waitFor(() => expect(push).toHaveBeenCalledWith('/kid'))
    expect(screen.queryByText('secret')).toBeNull()
  })

  test('parent sees children', async () => {
    auth({})
    renderGuard()
    expect(await screen.findByText('secret')).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
  })
})
