import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SettingsList } from '@/v2/manage/SettingsList'
import { SettingsPage } from '@/v2/manage/SettingsPage'
import { MorePage } from '@/v2/parent/MorePage'

const mockRouter = { query: {} as Record<string, string>, replace: jest.fn() }
jest.mock('next/router', () => ({ useRouter: () => ({ ...mockRouter, pathname: '/settings' }) }))
jest.mock('@/v2/api', () => ({ api: jest.fn(async () => ({})) }))
jest.mock('@/v2/components/RequireParent', () => ({ RequireParent: ({ children }: { children: ReactNode }) => <>{children}</> }))
jest.mock('@/v2/parent/ParentShell', () => ({
  ParentShell: ({ list, children }: { list: ReactNode; children: ReactNode }) => (
    <>
      {list}
      {children}
    </>
  ),
}))
jest.mock('@/contexts/UnifiedAuthContext', () => ({ useUnifiedAuth: () => ({ user: { username: 'Mom' } }) }))

const sections = [
  { id: 'family', label: 'Family', description: 'Name, time zone', icon: 'home' },
  { id: 'hours', label: 'Hours', description: 'School nights', icon: 'schedule' },
]

const wrap = (ui: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MantineProvider>{ui}</MantineProvider>
    </QueryClientProvider>,
  )

describe('SettingsList', () => {
  test('each section links to ?section= with its one-line description; the open one is current', () => {
    render(<SettingsList sections={sections} section="hours" />)
    const hours = screen.getByRole('link', { name: /Hours/ })
    expect(hours).toHaveAttribute('href', '/settings?section=hours')
    expect(hours).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Family/ })).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Name, time zone')).toBeInTheDocument()
  })

  test('on the phone list nothing is marked current', () => {
    render(<SettingsList sections={sections} />)
    expect(screen.queryByRole('link', { current: 'page' })).toBeNull()
  })
})

describe('Screen time moved to Rewards', () => {
  beforeAll(() => {
    window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never
  })
  beforeEach(() => {
    mockRouter.query = {}
    mockRouter.replace.mockReset()
  })

  test('Settings lists no Screen time section', () => {
    wrap(<SettingsPage />)
    expect(screen.getByRole('link', { name: /Hours/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Screen time/ })).toBeNull()
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  test('More page has no Screen time link', () => {
    wrap(<MorePage onLogout={() => {}} />)
    expect(screen.getByRole('link', { name: /Hours/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Screen time/ })).toBeNull()
  })

  test('/settings?section=screen redirects to Rewards → Screen time', () => {
    mockRouter.query = { section: 'screen' }
    wrap(<SettingsPage />)
    expect(mockRouter.replace).toHaveBeenCalledWith('/kids?section=rewards&item=screen')
  })
})
