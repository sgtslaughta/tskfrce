import { render, screen } from '@testing-library/react'
import { useRouter } from 'next/router'
import { ReactNode } from 'react'
import { ParentShell } from '@/v2/parent/ParentShell'

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
  Bell: () => null,
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
    render(<ParentShell title="Test">Content</ParentShell>)

    const shell = document.querySelector('.p-shell')
    expect(shell).toBeInTheDocument()
  })

  test('displays title and children content', () => {
    render(<ParentShell title="Test Page">Test Content</ParentShell>)

    expect(screen.getByText('Test Page')).toBeInTheDocument()
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  test('renders navigation with links to main pages', () => {
    render(<ParentShell title="Test">Content</ParentShell>)

    // Check that navigation links exist
    const navs = screen.getAllByRole('navigation', { name: /main/i })
    expect(navs.length).toBeGreaterThan(0)
  })

  test('marks active page with aria-current', () => {
    ;(useRouter as jest.Mock).mockReturnValue({
      pathname: '/devices',
      push: jest.fn(),
      replace: jest.fn(),
      query: {},
    })

    render(<ParentShell title="Test">Content</ParentShell>)

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
      <ParentShell title="Test" actions={<button>Action</button>}>
        Content
      </ParentShell>
    )

    expect(screen.getByText('Action')).toBeInTheDocument()
  })

  test('renders shell with list and detail when list prop provided', () => {
    render(
      <ParentShell title="Test" list={<div>List</div>}>
        Detail Content
      </ParentShell>
    )

    expect(screen.getByText('List')).toBeInTheDocument()
    expect(screen.getByText('Detail Content')).toBeInTheDocument()
  })
})
