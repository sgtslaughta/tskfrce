import { describe, expect, test, beforeEach, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { Rail } from '@/v2/parent/Rail'

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/',
    query: {},
  }),
}))

jest.mock('@/v2/hooks/useChat', () => ({
  useThreads: () => ({
    data: {
      total: 0,
    },
  }),
}))

jest.mock('@/v2/components/Bell', () => ({
  Bell: ({ placement }: { placement: string }) => (
    <button aria-label="Notifications" type="button">
      Bell {placement}
    </button>
  ),
}))

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>{ui}</MantineProvider>
    </QueryClientProvider>,
  )

describe('Parent UI icon-only buttons accessibility', () => {
  test('Rail items have accessible names', () => {
    wrap(<Rail />)

    // Check that all rail items have aria-label
    expect(screen.getByRole('link', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Devices' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kids & chores' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chat' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
  })

  test('Rail logo has accessible name', () => {
    wrap(<Rail />)
    const logo = screen.getByRole('link', { name: 't@sk4ce' })
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('aria-label', 't@sk4ce')
  })

  test('All navigation buttons have aria-label for tooltips', () => {
    wrap(<Rail />)

    // Verify all important items have aria-label set
    const items = [
      { name: 'Today' },
      { name: 'Devices' },
      { name: 'Kids & chores' },
      { name: 'Chat' },
      { name: 'Settings' },
    ]

    items.forEach((item) => {
      const element = screen.getByRole('link', { name: item.name })
      expect(element).toHaveAttribute('aria-label', item.name)
    })
  })
})

describe('Parent UI motion and prefers-reduced-motion support', () => {
  test('motion tokens are defined in CSS', () => {
    wrap(<Rail />)

    // Verify that motion token definitions exist in the CSS
    const style = window.getComputedStyle(document.documentElement)

    // Check that CSS custom properties are defined
    // Note: These are injected in jest.setup.js
    const dur1 = style.getPropertyValue('--dur-1').trim()
    const dur2 = style.getPropertyValue('--dur-2').trim()
    const easeOut = style.getPropertyValue('--ease-out').trim()

    expect(dur1).toBeTruthy()
    expect(dur2).toBeTruthy()
    expect(easeOut).toBeTruthy()
  })

  test('prefers-reduced-motion support is in place', () => {
    // The CSS should include @media (prefers-reduced-motion: reduce) rules
    // that set animation-duration and transition-duration to 0.01ms

    wrap(<Rail />)

    // Verify that the motion.css file is loaded and contains prefers-reduced-motion rules
    const styleSheets = Array.from(document.styleSheets)
    const hasReducedMotionRules = styleSheets.some((sheet) => {
      try {
        const rules = Array.from(sheet.cssRules || [])
        return rules.some((rule) => {
          const ruleText = rule.cssText || ''
          return ruleText.includes('prefers-reduced-motion')
        })
      } catch {
        // Cross-origin or restricted stylesheets will throw
        return false
      }
    })

    // Verify that prefers-reduced-motion rules are actually present in CSS
    expect(hasReducedMotionRules).toBe(true)
  })
})
