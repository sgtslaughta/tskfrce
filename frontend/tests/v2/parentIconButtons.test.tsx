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
