import { expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { api } from '@/v2/api'
import { KidDetail } from '@/v2/manage/KidDetail'
import { fridgeTheme } from '@/v2/theme'
import type { Kid } from '@/v2/types'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('next/router', () => ({ useRouter: () => ({ asPath: '/kids', query: {}, push: jest.fn() }) }))
const apiMock = api as unknown as Mock<(p: string) => Promise<unknown>>

test('kid profile lists points history newest first, deductions in red', async () => {
  const now = new Date().toISOString()
  apiMock.mockImplementation(async (p: string) =>
    p.startsWith('/kids/2/points')
      ? [
          { id: 2, amount: -10, reason: 'deduction', label: 'Feed the cat — late', at: now },
          { id: 1, amount: 30, reason: 'chore', label: 'Homework', at: now },
        ]
      : p === '/today' ? { kids: [] } : [],
  )
  const kid = { id: 2, full_name: 'Mia', username: 'mia', avatar: null, has_pin: false } as unknown as Kid
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MantineProvider theme={fridgeTheme}>
        <KidDetail kid={kid} onDeleted={() => {}} />
      </MantineProvider>
    </QueryClientProvider>,
  )
  const neg = await screen.findByText('−10')
  expect(neg).toHaveAttribute('data-neg', 'true')
  expect(screen.getByText('+30')).toBeInTheDocument()
  expect(screen.getByText(/· Feed the cat — late$/)).toBeInTheDocument()
})
