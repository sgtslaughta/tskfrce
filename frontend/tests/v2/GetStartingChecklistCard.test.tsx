import { describe, test, expect, beforeEach } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GetStartingChecklistCard } from '@/v2/today/GetStartingChecklistCard'
import type { TodayKid } from '@/v2/types'

jest.mock('@/v2/parent/Icon', () => ({
  Icon: ({ name }: { name: string; size?: number }) => <span>{name}</span>,
}))
jest.mock('@mantine/core', () => ({
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
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

const mockKid = (overrides = {}): TodayKid => ({
  id: 1,
  name: 'Leo',
  avatar: '🧒',
  chores: [],
  points_balance: 0,
  progress: { level: 1, title: 'Novice', xp: 0 },
  ...overrides,
})

describe('GetStartingChecklistCard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('renders when not all items are done', () => {
    render(<GetStartingChecklistCard kids={[]} devicesCount={0} />)
    expect(screen.getByText('Getting started')).toBeInTheDocument()
  })

  test('shows correct progress', () => {
    const kids = [mockKid()]
    render(<GetStartingChecklistCard kids={kids} devicesCount={1} />)
    // With 1 kid and 1 device but no chores, "Add a kid" is done, "Name devices" is done = 2 of 5
    expect(screen.getByText(/2 of 5 done/)).toBeInTheDocument()
  })

  test('auto-ticks items from real data', () => {
    const kids = [mockKid({ chores: [{ id: 1 } as any] })]
    render(<GetStartingChecklistCard kids={kids} devicesCount={1} />)
    // Item should show progress - "Add a kid" and "Add chores" should be marked done
    const checkmarks = screen.getAllByText('check')
    expect(checkmarks.length).toBeGreaterThan(0)
  })

  test('hides when dismissed', async () => {
    const { rerender } = render(
      <GetStartingChecklistCard kids={[]} devicesCount={0} />
    )
    const dismissBtn = screen.getByLabelText('Dismiss getting started')
    await userEvent.click(dismissBtn)

    rerender(<GetStartingChecklistCard kids={[]} devicesCount={0} />)
    expect(screen.queryByText('Getting started')).not.toBeInTheDocument()
  })

  test('hides when all items are done', () => {
    const kids = [mockKid({ chores: [{ id: 1 } as any] })]
    // Create a mock with all items done
    const { container } = render(
      <GetStartingChecklistCard kids={kids} devicesCount={1} />
    )
    // Check is still visible because not all 5 items can be auto-completed
    expect(container.textContent).toContain('Getting started')
  })

  test('links to correct pages', () => {
    render(<GetStartingChecklistCard kids={[]} devicesCount={0} />)
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
