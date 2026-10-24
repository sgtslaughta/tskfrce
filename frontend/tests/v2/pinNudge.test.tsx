import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fridgeTheme } from '@/v2/theme'
import { api } from '@/v2/api'
import { PINsNudge } from '@/v2/today/PINsNudge'
import { DeviceRow } from '@/v2/manage/DeviceRow'
import { KidsPage } from '@/v2/manage/KidsPage'
import type { Device, Kid, SharedDeviceNudge } from '@/v2/types'

const push = jest.fn()
let query: Record<string, string> = {}
jest.mock('next/router', () => ({ useRouter: () => ({ query, push, replace: jest.fn() }) }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@/v2/today/DeviceQuickMenu', () => ({
  DeviceQuickMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
jest.mock('@/v2/parent/ParentShell', () => ({
  ParentShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
jest.mock('@/v2/components/RequireParent', () => ({
  RequireParent: ({ children }: { children: ReactNode }) => <>{children}</>,
  startSignOut: jest.fn(),
  cancelSignOut: jest.fn(),
}))
jest.mock('@/v2/parent/useLook', () => ({
  useLook: jest.fn(),
}))
jest.mock('@/contexts/UnifiedAuthContext', () => ({
  useUnifiedAuth: jest.fn(() => ({
    user: { id: '1', username: 'testuser' },
    logout: jest.fn(),
  })),
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
const kids: Kid[] = [
  { id: 7, full_name: 'Maya', username: 'kid-maya', avatar: null, has_pin: false },
  { id: 8, full_name: 'Leo', username: 'kid-leo', avatar: null, has_pin: false },
]
const nudge: SharedDeviceNudge = { device_id: 1, device_name: 'Family iPad', kid_ids: [7, 8], kid_names: ['Maya', 'Leo'] }
const device: Device = {
  id: 1, name: 'Family iPad', mac: 'aa:bb', vendor: null, status: 'assigned', owner_ids: [7, 8],
  group_ids: [], online: false, override: null, last_seen: null, resisting: false, needs_pins: true,
}
const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MantineProvider theme={fridgeTheme}>{ui}</MantineProvider>
  </QueryClientProvider>
)
const TEXT = "Maya and Leo share Family iPad. Add PINs so they can't sign in as each other."

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never
  global.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = jest.fn()
})
beforeEach(() => {
  push.mockReset()
  query = {}
  apiMock.mockReset().mockImplementation(async (path) => (path === '/kids' ? kids : path === '/chores/' ? [] : {}))
})

describe('PINsNudge', () => {
  test('renders names and device, and Set PINs opens the first kid PIN editor', async () => {
    render(wrap(<PINsNudge nudges={[nudge]} />))
    expect(screen.getByText(TEXT)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Set PINs' }))
    expect(push).toHaveBeenCalledWith('/kids?section=kids&kid=7&pin=1')
  })

  test('hidden when list is empty', () => {
    render(wrap(<PINsNudge nudges={[]} />))
    expect(screen.queryByRole('button', { name: 'Set PINs' })).toBeNull()
    expect(screen.queryByText(/share/)).toBeNull()
  })

  test('uses parent token CSS variables for colors', () => {
    const { container } = render(wrap(<PINsNudge nudges={[nudge]} />))
    const div = container.querySelector('div')
    expect(div?.style.border).toContain('var(--p-line)')
    expect(div?.style.backgroundColor).toContain('var(--p-soft)')
    const p = container.querySelector('p')
    expect(p?.style.color).toContain('var(--p-sub)')
    const button = screen.getByRole('button', { name: 'Set PINs' })
    expect(button).toHaveStyle('backgroundColor: var(--p-ink)')
    expect(button).toHaveStyle('color: var(--p-card)')
  })
})

describe('DeviceRow needs_pins note', () => {
  const row = (d: Device) => render(wrap(<DeviceRow device={d} kids={kids} />))

  test('shows note and Set PINs navigates to the first owner', async () => {
    row(device)
    expect(screen.getByText("Maya and Leo share this device. Add PINs so they can't sign in as each other.")).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Set PINs' }))
    expect(push).toHaveBeenCalledWith('/kids?section=kids&kid=7&pin=1')
  })

  test('hidden when needs_pins is false', () => {
    row({ ...device, needs_pins: false })
    expect(screen.queryByRole('button', { name: 'Set PINs' })).toBeNull()
  })

  test('uses parent token CSS variables for colors', () => {
    const { container } = row(device)
    const noteDiv = container.querySelector('div[style*="border"]')
    expect(noteDiv?.style.border).toContain('var(--p-line)')
    expect(noteDiv?.style.backgroundColor).toContain('var(--p-soft)')
    const p = screen.getByText(/share this device/)
    expect(p).toHaveStyle('color: var(--p-sub)')
    const button = screen.getByRole('button', { name: 'Set PINs' })
    expect(button).toHaveStyle('backgroundColor: var(--p-ink)')
    expect(button).toHaveStyle('color: var(--p-card)')
  })
})

describe('deep link target', () => {
  test('?section=kids&kid=7&pin=1 opens that kid drawer with the PIN field focused', async () => {
    query = { section: 'kids', kid: '7', pin: '1' }
    render(wrap(<KidsPage />))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('Edit kid')
    const pin = await screen.findByLabelText('PIN (4 digits)')
    expect(document.activeElement).toBe(pin)
  })

  test('no kid param leaves the drawer closed', async () => {
    query = { section: 'kids' }
    render(wrap(<KidsPage />))
    await screen.findByText('Maya')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
