import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GetStartingChecklistCard } from '../GetStartingChecklistCard'
import * as tipsModule from '../../hooks/useTips'
import type { TodayKid } from '../../types'

jest.mock('../../hooks/useTips')
jest.mock('next/link', () => {
  const Link = ({ children, href }: any) => <a href={href}>{children}</a>
  Link.displayName = 'Link'
  return Link
})

const mockKid: TodayKid = {
  id: 1,
  name: 'Leo',
  avatar: '🦁',
  chores: [{ id: 1, points: 10, title: 'Chore', state: 'todo' }],
  online_all: false,
  devices: [],
}

describe('GetStartingChecklistCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders when not all items are done', () => {
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => false,
      dismiss: jest.fn(),
    })

    render(<GetStartingChecklistCard kids={[]} devicesCount={0} />)

    expect(screen.getByTestId('parent-onboarding')).toBeInTheDocument()
    expect(screen.getByText('Getting started')).toBeInTheDocument()
  })

  it('hides when all items are done', () => {
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => false,
      dismiss: jest.fn(),
    })

    const { container } = render(
      <GetStartingChecklistCard kids={[mockKid]} devicesCount={1} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('hides when dismissed', () => {
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => true,
      dismiss: jest.fn(),
    })

    const { container } = render(<GetStartingChecklistCard kids={[]} />)

    expect(container.firstChild).toBeNull()
  })

  it('auto-ticks items based on real data', () => {
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => false,
      dismiss: jest.fn(),
    })

    render(<GetStartingChecklistCard kids={[mockKid]} devicesCount={1} />)

    expect(screen.getByText('3 of 5 done')).toBeInTheDocument()
  })

  it('marks item as done when kids exist', () => {
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => false,
      dismiss: jest.fn(),
    })

    const { container } = render(<GetStartingChecklistCard kids={[mockKid]} />)

    const doneItems = container.querySelectorAll('[data-done="true"]')
    expect(doneItems.length).toBeGreaterThan(0)
  })

  it('calls dismiss when dismissal button is clicked', async () => {
    const dismiss = jest.fn()
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => false,
      dismiss,
    })

    render(<GetStartingChecklistCard kids={[]} />)

    const dismissBtn = screen.getByLabelText('Dismiss getting started')
    await userEvent.click(dismissBtn)

    expect(dismiss).toHaveBeenCalledWith('onboard.parent')
  })

  it('has correct link destinations', () => {
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => false,
      dismiss: jest.fn(),
    })

    render(<GetStartingChecklistCard kids={[]} />)

    expect(screen.getByText('Add a kid').closest('a')).toHaveAttribute(
      'href',
      '/kids'
    )
    expect(screen.getByText('Set hours').closest('a')).toHaveAttribute(
      'href',
      '/settings?section=hours'
    )
  })

  it('shows progress correctly', () => {
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => false,
      dismiss: jest.fn(),
    })

    render(<GetStartingChecklistCard kids={[mockKid]} devicesCount={0} />)

    expect(screen.getByText('2 of 5 done')).toBeInTheDocument()
  })
})
