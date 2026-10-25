import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useRouter } from 'next/router'
import { KidPage } from '@/v2/kid/KidPage'
import { api } from '@/v2/api'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { fridgeTheme } from '@/v2/theme'

jest.mock('@/v2/api', () => ({ ...(jest.requireActual('@/v2/api') as object), api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('@/contexts/UnifiedAuthContext', () => ({ useUnifiedAuth: jest.fn() }))
jest.mock('next/router', () => ({ useRouter: jest.fn() }))

const apiMock = api as unknown as Mock<(p: string, i?: { asKid?: number; kid?: boolean }) => Promise<unknown>>
const push = jest.fn()

const data: Record<string, unknown> = {
  '/kid/today': {
    locked: true,
    points_balance: 4,
    chores: [{ id: 7, title: 'Dishes', points: 5, state: 'todo' }],
  },
  '/leaderboard': { rows: [] },
  '/kids': [{ id: 3, full_name: 'Ana', username: 'ana', avatar: '🦊', has_pin: false }],
}

beforeEach(() => {
  apiMock.mockReset().mockImplementation(async (p) => data[p] ?? [])
  ;(notifications.show as unknown as Mock<() => void>).mockReset()
  push.mockReset()
  ;(useRouter as unknown as Mock<() => unknown>).mockReturnValue({ query: { as: '3' }, push })
  ;(useUnifiedAuth as unknown as Mock<() => unknown>).mockReturnValue({ user: { role: 'parent' }, isLoading: false })
  window.matchMedia =
    window.matchMedia ||
    ((() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never)
})

function renderKid() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider theme={fridgeTheme}>
        <KidPage />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('parent view-as-kid', () => {
  test('shows banner, loads with asKid, is read-only (no mark-done)', async () => {
    renderKid()
    expect(await screen.findByText('Dishes')).toBeInTheDocument()
    expect(await screen.findByText(/Viewing as Ana · preview/)).toBeInTheDocument()
    expect(apiMock).toHaveBeenCalledWith('/kid/today', { asKid: 3 })
    expect(apiMock.mock.calls.some((c) => c[1]?.kid)).toBe(false)
    expect(screen.queryByRole('button', { name: /mark done/i })).toBeNull()
    expect(apiMock.mock.calls.some((c) => c[0].includes('/done'))).toBe(false)
  })

  test('back button returns to the parent side', async () => {
    renderKid()
    await userEvent.click(await screen.findByRole('button', { name: 'Back to parent' }))
    expect(push).toHaveBeenCalledWith('/?item=3')
  })

  test('preview bar has visibility icon and dark background', async () => {
    renderKid()
    const previewBar = await screen.findByRole('status')
    expect(previewBar).toHaveStyle('backgroundColor: #292928')
  })

  test('non-parent ignores ?as and shows the normal kid flow', async () => {
    ;(useUnifiedAuth as unknown as Mock<() => unknown>).mockReturnValue({ user: null, isLoading: false })
    renderKid()
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/kid/whoami'))
    expect(screen.queryByText(/preview/)).toBeNull()
  })
})
