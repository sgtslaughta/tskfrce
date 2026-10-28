import { beforeEach, describe, expect, test } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { KidIntroSwipe } from '@/v2/kid/KidIntroSwipe'

let state = { ready: true, dismissed: new Set<string>() }
const dismiss = jest.fn()
jest.mock('@/v2/hooks/useTips', () => ({
  useTipState: (kid: boolean) => {
    if (!kid) throw new Error('kid intro must use the kid token')
    return { ready: state.ready, isDismissed: (k: string) => state.dismissed.has(k), dismiss }
  },
}))

const show = (onComplete = jest.fn()) => {
  render(
    <MantineProvider>
      <KidIntroSwipe onComplete={onComplete} />
    </MantineProvider>,
  )
  return onComplete
}

describe('KidIntroSwipe', () => {
  beforeEach(() => {
    state = { ready: true, dismissed: new Set() }
    dismiss.mockClear()
    localStorage.clear()
  })

  test('walks three cards, Done dismisses on the box and completes', async () => {
    const done = show()
    expect(screen.getByText('Do your chores')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Ask for rewards')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(dismiss).toHaveBeenCalledWith('onboard.kid')
    expect(done).toHaveBeenCalled()
  })

  test('Skip dismisses and completes', async () => {
    const done = show()
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(dismiss).toHaveBeenCalledWith('onboard.kid')
    expect(done).toHaveBeenCalled()
  })

  test('Escape is Skip', async () => {
    const done = show()
    await userEvent.keyboard('{Escape}')
    expect(dismiss).toHaveBeenCalledWith('onboard.kid')
    expect(done).toHaveBeenCalled()
  })

  test('dots jump to a card', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Go to slide 3' }))
    expect(screen.getByText('Tell a parent')).toBeInTheDocument()
  })

  test('hidden when dismissed, and until the box answers', () => {
    state.dismissed.add('onboard.kid')
    show()
    expect(screen.queryByTestId('kid-intro-swipe')).not.toBeInTheDocument()
    state = { ready: false, dismissed: new Set() }
    show()
    expect(screen.queryByTestId('kid-intro-swipe')).not.toBeInTheDocument()
  })

  test('Skip also remembers in this browser, so a failed save does not bring it back', async () => {
    localStorage.clear()
    const first = render(
      <MantineProvider>
        <KidIntroSwipe kidId={4} onComplete={() => {}} />
      </MantineProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(localStorage.getItem('tskfrce.intro.4')).toBe('1')
    first.unmount()
    render(
      <MantineProvider>
        <KidIntroSwipe kidId={4} onComplete={() => {}} />
      </MantineProvider>,
    )
    expect(screen.queryByTestId('kid-intro-swipe')).not.toBeInTheDocument()
  })
})
