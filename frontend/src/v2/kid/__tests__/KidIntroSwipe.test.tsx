import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KidIntroSwipe } from '../KidIntroSwipe'
import * as tipsModule from '../../hooks/useTips'

jest.mock('../../hooks/useTips')
jest.mock('../../components/StickerCard', () => ({
  StickerCard: ({ children }: any) => <div data-testid="sticker-card">{children}</div>,
}))

describe('KidIntroSwipe', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders when not dismissed', () => {
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => false,
      dismiss: jest.fn(),
    })

    render(<KidIntroSwipe onComplete={jest.fn()} />)

    expect(screen.getByTestId('kid-intro-swipe')).toBeInTheDocument()
    expect(screen.getByText('Do Your Chores')).toBeInTheDocument()
  })

  it('hides when dismissed', () => {
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => true,
      dismiss: jest.fn(),
    })

    const { container } = render(<KidIntroSwipe onComplete={jest.fn()} />)

    expect(container.firstChild).toBeNull()
  })

  it('advances to next card on Next click', async () => {
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => false,
      dismiss: jest.fn(),
    })

    render(<KidIntroSwipe onComplete={jest.fn()} />)

    expect(screen.getByText('Do Your Chores')).toBeInTheDocument()
    expect(screen.getByText('Complete the chores your family gives you')).toBeInTheDocument()

    const nextBtn = screen.getByText('Next')
    await userEvent.click(nextBtn)

    expect(screen.getByText('Ask for Rewards')).toBeInTheDocument()
  })

  it('shows Done button on last card', async () => {
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => false,
      dismiss: jest.fn(),
    })

    render(<KidIntroSwipe onComplete={jest.fn()} />)

    const nextBtn = screen.getByText('Next')
    await userEvent.click(nextBtn)
    await userEvent.click(nextBtn)

    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('calls onComplete and dismiss on Done click', async () => {
    const onComplete = jest.fn()
    const dismiss = jest.fn()
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => false,
      dismiss,
    })

    render(<KidIntroSwipe onComplete={onComplete} />)

    const nextBtn = screen.getByText('Next')
    await userEvent.click(nextBtn)
    await userEvent.click(nextBtn)

    const doneBtn = screen.getByText('Done')
    await userEvent.click(doneBtn)

    expect(dismiss).toHaveBeenCalledWith('onboard.kid')
    expect(onComplete).toHaveBeenCalled()
  })

  it('calls onComplete and dismiss on Skip click', async () => {
    const onComplete = jest.fn()
    const dismiss = jest.fn()
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => false,
      dismiss,
    })

    render(<KidIntroSwipe onComplete={onComplete} />)

    const skipBtn = screen.getByText('Skip')
    await userEvent.click(skipBtn)

    expect(dismiss).toHaveBeenCalledWith('onboard.kid')
    expect(onComplete).toHaveBeenCalled()
  })

  it('navigates to card by dot click', async () => {
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => false,
      dismiss: jest.fn(),
    })

    render(<KidIntroSwipe onComplete={jest.fn()} />)

    const dots = screen.getAllByRole('button', { name: /Go to slide/ })
    await userEvent.click(dots[2])

    expect(screen.getByText('Tell Mom or Dad')).toBeInTheDocument()
  })

  it('uses ageGroup prop for wording', () => {
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => false,
      dismiss: jest.fn(),
    })

    render(<KidIntroSwipe onComplete={jest.fn()} ageGroup="little" />)

    // All age groups use same wording in wordsMap
    expect(screen.getByText('Do Your Chores')).toBeInTheDocument()
  })

  it('highlights active dot', async () => {
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => false,
      dismiss: jest.fn(),
    })

    render(<KidIntroSwipe onComplete={jest.fn()} />)

    const dots = screen.getAllByRole('button', { name: /Go to slide/ })
    expect(dots[0]).toHaveAttribute('data-active', 'true')
    expect(dots[1]).toHaveAttribute('data-active', 'false')

    await userEvent.click(dots[1])

    expect(dots[0]).toHaveAttribute('data-active', 'false')
    expect(dots[1]).toHaveAttribute('data-active', 'true')
  })

  it('is keyboard accessible', async () => {
    ;(tipsModule.useTips as jest.Mock).mockReturnValue({
      isDismissed: () => false,
      dismiss: jest.fn(),
    })

    render(<KidIntroSwipe onComplete={jest.fn()} />)

    const dots = screen.getAllByRole('button', { name: /Go to slide/ })
    expect(dots[0]).toHaveAttribute('aria-label', 'Go to slide 1')
    expect(dots[1]).toHaveAttribute('aria-label', 'Go to slide 2')
  })
})
