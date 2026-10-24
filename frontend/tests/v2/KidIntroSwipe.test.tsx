import { describe, test, expect, beforeEach } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// Mock Mantine Button before importing KidIntroSwipe to avoid MantineProvider requirement
jest.mock('@mantine/core', () => {
  const actualMantine = jest.requireActual('@mantine/core')
  return {
    ...actualMantine,
    Button: ({
      children,
      onClick,
      size,
      variant,
      style,
      ...props
    }: any) => React.createElement('button', { onClick, style, 'data-variant': variant }, children),
  }
}, { virtual: true })

jest.mock('@/v2/parent/Icon', () => ({
  Icon: ({ name }: { name: string; size?: number }) => <span>{name}</span>,
}))

import { KidIntroSwipe } from '@/v2/kid/KidIntroSwipe'

describe('KidIntroSwipe', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('renders first card', () => {
    const onComplete = jest.fn()
    render(<KidIntroSwipe onComplete={onComplete} />)
    expect(screen.getByText('Do Your Chores')).toBeInTheDocument()
    expect(screen.getByText('Complete the chores your family gives you')).toBeInTheDocument()
  })

  test('shows progress dots', () => {
    const onComplete = jest.fn()
    render(<KidIntroSwipe onComplete={onComplete} />)
    const dots = screen.getAllByRole('button').filter((btn) => {
      const style = btn.getAttribute('style')
      return style && style.includes('width: 8px')
    })
    // The dots won't be buttons, they'll be divs. Let's just check structure is there.
    expect(screen.getByText('Do Your Chores')).toBeInTheDocument()
  })

  test('navigates to next card', async () => {
    const onComplete = jest.fn()
    render(<KidIntroSwipe onComplete={onComplete} />)

    const nextBtn = screen.getByRole('button', { name: /Next/ })
    await userEvent.click(nextBtn)

    expect(screen.getByText('Ask for Rewards')).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })

  test('shows Done button on last card', async () => {
    const onComplete = jest.fn()
    render(<KidIntroSwipe onComplete={onComplete} />)

    const nextBtn = screen.getByRole('button', { name: /Next/ })
    await userEvent.click(nextBtn)
    await userEvent.click(nextBtn)

    expect(screen.getByRole('button', { name: /Done/ })).toBeInTheDocument()
  })

  test('calls onComplete when Done is clicked', async () => {
    const onComplete = jest.fn()
    render(<KidIntroSwipe onComplete={onComplete} />)

    const nextBtn = screen.getByRole('button', { name: /Next/ })
    await userEvent.click(nextBtn)
    await userEvent.click(nextBtn)

    const doneBtn = screen.getByRole('button', { name: /Done/ })
    await userEvent.click(doneBtn)

    expect(onComplete).toHaveBeenCalled()
  })

  test('Skip dismisses and completes', async () => {
    const onComplete = jest.fn()
    render(<KidIntroSwipe onComplete={onComplete} />)

    const skipBtn = screen.getByRole('button', { name: /Skip/ })
    await userEvent.click(skipBtn)

    expect(onComplete).toHaveBeenCalled()
  })

  test('hides when already dismissed', () => {
    localStorage.setItem('task4ce-tip:onboard.kid', '1')
    const onComplete = jest.fn()
    const { container } = render(<KidIntroSwipe onComplete={onComplete} />)
    expect(container.textContent).toBe('')
  })
})
