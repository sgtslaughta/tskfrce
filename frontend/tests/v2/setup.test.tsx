import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SetupPage from '../../pages/setup'
import { api, ApiError } from '@/v2/api'
import { fridgeTheme } from '@/v2/theme'

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
    if (path === '/setup' && init?.method === 'POST') return { access_token: 't' }
    if (path === '/setup') return { needed: true }
    if (path === '/devices') return []
    return {}
  })
  replace.mockReset()
  push.mockReset()
  loginWithToken.mockReset()
})

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

async function toParent(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Family name'), 'Smiths')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await user.type(await screen.findByLabelText('Your name'), 'Sam')
  await user.type(screen.getByLabelText('Username'), 'sam')
}

describe('setup wizard', () => {
  test('step 1 shows the detected time zone', () => {
    wrap()
    expect(screen.getByRole('textbox', { name: 'Time zone' })).toHaveValue(tz)

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
    await toParent(user)
    await user.type(screen.getByLabelText(/^Password/), 'longenough1')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    const link = await screen.findByRole('link', { name: 'Log in' })
    expect(link).toHaveAttribute('href', '/login')
  })

  test('skipping steps 3 to 6 reaches Finish', async () => {
    const user = userEvent.setup()
    wrap()
    await toParent(user)
    await user.type(screen.getByLabelText(/^Password/), 'longenough1')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(loginWithToken).toHaveBeenCalledWith('t'))
    for (let i = 0; i < 4; i++) await user.click(await screen.findByRole('button', { name: 'Skip' }))
    await user.click(await screen.findByRole('button', { name: 'Finish' }))
    expect(push).toHaveBeenCalledWith('/')
    expect(replace).not.toHaveBeenCalled()
  })
})
