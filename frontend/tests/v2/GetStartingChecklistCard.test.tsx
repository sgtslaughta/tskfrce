import { describe, test, expect, beforeEach } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GetStartingChecklistCard } from '@/v2/today/GetStartingChecklistCard'
import type { TodayKid } from '@/v2/types'

jest.mock('@/v2/parent/Icon', () => ({
  Icon: ({ name }: { name: string; size?: number }) => <span>{name}</span>,
}))
jest.mock('@mantine/core', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  ActionIcon: ({
    children,
    onClick,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode
    onClick?: () => void
    'aria-label'?: string
  }) => (
    <button onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  ),
  Group: ({
    children,
    justify,
    mb,
  }: {
    children: React.ReactNode
    justify?: string
    mb?: string
  }) => <div>{children}</div>,
  Stack: ({
    children,
    gap,
  }: {
    children: React.ReactNode
    gap?: string
  }) => <div>{children}</div>,
}))
let windows: unknown[] = []
let parents: unknown[] = [{ id: 1 }]
jest.mock('@/v2/hooks/useWindows', () => ({ useWindows: () => ({ data: windows }) }))
jest.mock('@/v2/hooks/useFamily', () => ({ useParents: () => ({ data: parents }) }))
const dismissed = new Set<string>()
const dismiss = jest.fn((k: string) => dismissed.add(k))
jest.mock('@/v2/hooks/useTips', () => ({
  useTipState: () => ({ ready: true, isDismissed: (k: string) => dismissed.has(k), dismiss }),
}))
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

const mockKid = (overrides = {}): TodayKid => ({
  id: 1,
  name: 'Leo',
  avatar: '🧒',
  online_all: false,
  chores: [],
  devices: [],
  ...overrides,
})

describe('GetStartingChecklistCard', () => {
  beforeEach(() => {
    dismissed.clear()
    windows = []
    parents = [{ id: 1 }]
    dismiss.mockClear()
  })

  test('renders when not all items are done', () => {
    render(<GetStartingChecklistCard kids={[]} />)
    expect(screen.getByText('Getting started')).toBeInTheDocument()
  })

  test('shows correct progress', () => {
    const kids = [mockKid({ devices: [{ id: 1, name: 'iPad', vendor: null, online: false }] })]
    render(<GetStartingChecklistCard kids={kids} />)
    // kid + device done; no chores, no hours, one parent
    expect(screen.getByText(/2 of 5 done/)).toBeInTheDocument()
  })

  test('auto-ticks items from real data', () => {
    const kids = [mockKid({ chores: [{ id: 1 } as any] })]
    render(<GetStartingChecklistCard kids={kids} />)
    // Item should show progress - "Add a kid" and "Add chores" should be marked done
    const checkmarks = screen.getAllByText('check')
    expect(checkmarks.length).toBeGreaterThan(0)
  })

  test('hides when dismissed', async () => {
    const { rerender } = render(
      <GetStartingChecklistCard kids={[]} />
    )
    const dismissBtn = screen.getByLabelText('Dismiss getting started')
    await userEvent.click(dismissBtn)
    expect(dismiss).toHaveBeenCalledWith('onboard.parent')

    rerender(<GetStartingChecklistCard kids={[]} />)
    expect(screen.queryByText('Getting started')).not.toBeInTheDocument()
  })

  test('ticks hours and second parent from the box and hides when all done', () => {
    const kids = [mockKid({ chores: [{ id: 1 } as any], devices: [{ id: 1, name: 'iPad', vendor: null, online: false }] })]
    windows = [{ id: 1 }]
    const { rerender } = render(<GetStartingChecklistCard kids={kids} />)
    expect(screen.getByText(/4 of 5 done/)).toBeInTheDocument()
    parents = [{ id: 1 }, { id: 2 }]
    rerender(<GetStartingChecklistCard kids={kids} />)
    expect(screen.queryByText('Getting started')).not.toBeInTheDocument()
  })

  test('links to correct pages', () => {
    render(<GetStartingChecklistCard kids={[]} />)
    expect(screen.getByRole('link', { name: /Add a kid/ })).toHaveAttribute(
      'href',
      '/kids'
    )
    expect(screen.getByRole('link', { name: /Add chores/ })).toHaveAttribute(
      'href',
      '/kids?section=chores'
    )
  })
})
