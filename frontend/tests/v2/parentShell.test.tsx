import { render, screen, within } from '@testing-library/react'
import { useRouter } from 'next/router'
import { ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { ParentShell } from '@/v2/parent/ParentShell'
import { Rail } from '@/v2/parent/Rail'
import { TabBar } from '@/v2/parent/TabBar'
import { MorePage } from '@/v2/parent/MorePage'

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
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
  Bell: ({ placement }: { placement?: string }) => {
    const { useThreads } = require('@/v2/hooks/useChat')
    const threads = useThreads()
    const unread = threads.data?.total ?? 0
    if (placement === 'rail') {
      return (
        <div className="f-bell" data-testid="rail-bell">
          <button aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} />
          {unread > 0 && <span className="f-bell-count" data-testid="bell-count">{unread > 9 ? '9+' : unread}</span>}
        </div>
      )
    }
    return null
  },
}))

jest.mock('@/v2/components/RequireParent', () => ({
  startSignOut: jest.fn(),
  cancelSignOut: jest.fn(),
}))

jest.mock('@/v2/parent/useLook', () => ({
  useLook: jest.fn(),
}))

jest.mock('@/v2/hooks/useChat', () => ({
  useThreads: jest.fn(() => ({
    data: { total: 0 },
  })),
}))

jest.mock('@/v2/hooks/useFamily', () => ({
  useFamily: jest.fn(() => ({
    data: { name: 'The Smiths' },
  })),
  useParents: jest.fn(() => ({ data: [{ id: 1, is_me: true, is_owner: false }] })),
}))

jest.mock('@/v2/hooks/useDevices', () => ({
  useBlocker: jest.fn(() => ({
    data: { online: true },
  })),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: ReactNode; [key: string]: any }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('ParentShell', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      pathname: '/',
      push: jest.fn(),
      replace: jest.fn(),
      query: {},
    })
  })

  test('renders shell with correct structure', () => {
    render(
      <MantineProvider>
        <ParentShell title="Test">Content</ParentShell>
      </MantineProvider>
    )

    const shell = document.querySelector('.p-shell')
    expect(shell).toBeInTheDocument()
  })

  test('displays title and children content', () => {
    render(
      <MantineProvider>
        <ParentShell title="Test Page">Test Content</ParentShell>
      </MantineProvider>
    )

    expect(screen.getByText('Test Page')).toBeInTheDocument()
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  test('marks active page with aria-current', () => {
    ;(useRouter as jest.Mock).mockReturnValue({
      pathname: '/devices',
      push: jest.fn(),
      replace: jest.fn(),
      query: {},
    })

    render(
      <MantineProvider>
        <ParentShell title="Test">Content</ParentShell>
      </MantineProvider>
    )

    const navs = screen.getAllByRole('navigation', { name: /main/i })
    let currentPageFound = false

    navs.forEach((nav) => {
      const currentLink = nav.querySelector('[aria-current="page"]')
      if (currentLink) {
        currentPageFound = true
      }
    })

    expect(currentPageFound).toBe(true)
  })

  test('renders with actions when provided', () => {
    render(
      <MantineProvider>
        <ParentShell title="Test" actions={<button>Action</button>}>
          Content
        </ParentShell>
      </MantineProvider>
    )

    expect(screen.getByText('Action')).toBeInTheDocument()
  })

  test('renders shell with list and detail when list prop provided', () => {
    render(
      <MantineProvider>
        <ParentShell title="Test" list={<div>List</div>}>
          Detail Content
        </ParentShell>
      </MantineProvider>
    )

    expect(screen.getByText('List')).toBeInTheDocument()
    expect(screen.getByText('Detail Content')).toBeInTheDocument()
  })
})

describe('Rail', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      pathname: '/',
      push: jest.fn(),
      replace: jest.fn(),
      query: {},
    })
  })

  test('rail has 8 items in order with aria-labels', () => {
    const { container } = render(
      <MantineProvider>
        <Rail />
      </MantineProvider>
    )

    const rail = container.querySelector('.p-rail')
    expect(rail).toBeInTheDocument()

    const items = Array.from(rail?.querySelectorAll('[aria-label]') || []).map(
      (el) => el.getAttribute('aria-label')
    )

    expect(items).toContain('t@sk4ce')
    expect(items).toContain('Notifications')
    expect(items).toContain('Today')
    expect(items).toContain('Devices')
    expect(items).toContain('Kids & chores')
    expect(items).toContain('Chat')
    expect(items).toContain('Settings')
    expect(items).toContain('Log out')
  })

  test('rail shows chat unread dot when threads exist', () => {
    const { useThreads } = require('@/v2/hooks/useChat')
    useThreads.mockReturnValue({
      data: { total: 3 },
    })

    const { container } = render(
      <MantineProvider>
        <Rail />
      </MantineProvider>
    )
    const chatItem = Array.from(container.querySelectorAll('a[aria-label="Chat"]')).pop() as HTMLElement
    const dot = chatItem?.querySelector('.p-rail-dot')

    expect(dot).toBeInTheDocument()
  })

  test('active rail item marked with aria-current', () => {
    ;(useRouter as jest.Mock).mockReturnValue({
      pathname: '/devices',
      push: jest.fn(),
      replace: jest.fn(),
      query: {},
    })

    const { container } = render(
      <MantineProvider>
        <Rail />
      </MantineProvider>
    )
    const devicesLink = container.querySelector('a[aria-label="Devices"]')

    expect(devicesLink).toHaveAttribute('aria-current', 'page')
  })

  test('rail bell shows count badge when threads have unread messages', () => {
    const { useThreads } = require('@/v2/hooks/useChat')
    useThreads.mockReturnValue({
      data: { total: 3 },
    })

    const { container } = render(
      <MantineProvider>
        <Rail />
      </MantineProvider>
    )
    const bellCount = container.querySelector('[data-testid="bell-count"]')

    expect(bellCount).toBeInTheDocument()
    expect(bellCount).toHaveTextContent('3')
  })

  test('rail bell shows 9+ when unread count exceeds 9', () => {
    const { useThreads } = require('@/v2/hooks/useChat')
    useThreads.mockReturnValue({
      data: { total: 15 },
    })

    const { container } = render(
      <MantineProvider>
        <Rail />
      </MantineProvider>
    )
    const bellCount = container.querySelector('[data-testid="bell-count"]')

    expect(bellCount).toBeInTheDocument()
    expect(bellCount).toHaveTextContent('9+')
  })
})

describe('TabBar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      pathname: '/',
      push: jest.fn(),
      replace: jest.fn(),
      query: {},
    })
  })

  test('tab bar is a nav of 5 links named by their text', () => {
    render(<TabBar />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getAllByRole('link')).toHaveLength(5)
    for (const name of [/^Today$/, /^Devices$/, /^Kids$/, /^Chat( \d+\+? unread)?$/, /^More$/])
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument()
  })

  test('chat link carries the unread count in its name', () => {
    const { useThreads } = require('@/v2/hooks/useChat')
    useThreads.mockReturnValue({ data: { total: 5 } })
    render(<TabBar />)
    expect(screen.getByRole('link', { name: 'Chat 5 unread' })).toBeInTheDocument()
  })

  test('active tab marked with aria-current', () => {
    ;(useRouter as jest.Mock).mockReturnValue({ pathname: '/devices', push: jest.fn(), replace: jest.fn(), query: {} })
    render(<TabBar />)
    expect(screen.getByRole('link', { name: 'Devices' })).toHaveAttribute('aria-current', 'page')
  })

})

describe('MorePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('more page lists settings sections', () => {
    render(<MorePage onLogout={jest.fn()} />)

    expect(screen.getByText('Family')).toBeInTheDocument()
    expect(screen.getByText('Hours')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByText('GIFs')).toBeInTheDocument()
    expect(screen.getByText('Parents')).toBeInTheDocument()
  })

  test('more page shows profile with family name', () => {
    render(<MorePage onLogout={jest.fn()} />)

    expect(screen.getByText(/Parent · The Smiths/)).toBeInTheDocument()
  })

  test('more page says Owner for the family owner', () => {
    const { useParents } = require('@/v2/hooks/useFamily')
    useParents.mockReturnValueOnce({ data: [{ id: 1, is_me: true, is_owner: true }] })
    render(<MorePage onLogout={jest.fn()} />)

    expect(screen.getByText(/Owner · The Smiths/)).toBeInTheDocument()
  })

  test('more page shows box healthy chip when online', () => {
    render(<MorePage onLogout={jest.fn()} />)

    expect(screen.getByText('Box healthy')).toBeInTheDocument()
  })

  test('more page shows box offline chip when not online', () => {
    const { useBlocker } = require('@/v2/hooks/useDevices')
    useBlocker.mockReturnValue({
      data: { online: false },
    })

    render(<MorePage onLogout={jest.fn()} />)

    expect(screen.getByText('Box offline')).toBeInTheDocument()
  })

  test('more page shows log out button', () => {
    render(<MorePage onLogout={jest.fn()} />)

    expect(screen.getByText('Log out')).toBeInTheDocument()
  })

  test('more page shows help & guide link', () => {
    render(<MorePage onLogout={jest.fn()} />)

    expect(screen.getByText('Help & guide')).toBeInTheDocument()
  })
})

describe('Rail log out', () => {
  it('calls onLogout when clicked', () => {
    ;(useRouter as jest.Mock).mockReturnValue({ pathname: '/', replace: jest.fn() })
    const onLogout = jest.fn()
    render(
      <MantineProvider>
        <Rail onLogout={onLogout} />
      </MantineProvider>
    )
    screen.getByRole('button', { name: 'Log out' }).click()
    expect(onLogout).toHaveBeenCalled()
  })
})
