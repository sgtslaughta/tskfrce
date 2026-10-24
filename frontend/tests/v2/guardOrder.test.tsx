import { beforeEach, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import type { ReactNode } from 'react'
import { render, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fridgeTheme } from '@/v2/theme'
import { api } from '@/v2/api'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { DevicesPage } from '@/v2/manage/DevicesPage'
import { KidsPage } from '@/v2/manage/KidsPage'
import { SettingsPage } from '@/v2/manage/SettingsPage'

const replace = jest.fn()
jest.mock('next/router', () => ({ useRouter: () => ({ replace, asPath: '/devices', query: {} }) }))
jest.mock('@/v2/api', () => ({ api: jest.fn(), CANT_REACH: 'x' }))
jest.mock('@/contexts/UnifiedAuthContext', () => ({ useUnifiedAuth: jest.fn() }))
jest.mock('@/v2/parent/ParentShell', () => ({
  ParentShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
jest.mock('@/v2/components/RequireParent', () => {
  const actualModule = jest.requireActual('@/v2/components/RequireParent')
  return {
    ...actualModule,
    startSignOut: jest.fn(),
    cancelSignOut: jest.fn(),
  }
})
jest.mock('@/v2/parent/useLook', () => ({
  useLook: jest.fn(),
}))
jest.mock('@/v2/chat/ChatDock', () => ({
  ChatDock: () => null,
}))
jest.mock('@/v2/components/BlockerBanner', () => ({
  BlockerBanner: () => null,
}))
jest.mock('@/v2/components/Bell', () => ({
  Bell: () => null,
}))
jest.mock('@/v2/hooks/useChat', () => ({
  useThreads: jest.fn(() => ({
    data: { total: 0 },
  })),
}))

const apiMock = api as unknown as Mock<(p: string) => Promise<unknown>>

beforeEach(() => {
  window.matchMedia = window.matchMedia || ((() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never)
  replace.mockReset()
  apiMock.mockReset().mockImplementation(async (p: string) => (p === '/setup' ? { needed: false } : []))
  ;(useUnifiedAuth as unknown as Mock<() => unknown>).mockReturnValue({ isInitialized: true, isAuthenticated: false, user: null })
})

test.each([
  ['DevicesPage', DevicesPage],
  ['KidsPage', KidsPage],
  ['SettingsPage', SettingsPage],
])('logged-out %s only checks setup, never loads data', async (_n, Page) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MantineProvider theme={fridgeTheme}>
        <Page />
      </MantineProvider>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(replace).toHaveBeenCalled())
  expect(apiMock.mock.calls.map((c) => c[0])).toEqual(['/setup'])
})
