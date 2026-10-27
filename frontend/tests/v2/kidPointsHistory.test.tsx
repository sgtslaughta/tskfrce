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
          { id: 1, amount: 30, reason: 'chore', label: 'Homework approved', at: now },
        ]
      : p === '/today' ? { kids: [] }
      : p === '/devices' ? [
          { id: 1, name: 'iPad', vendor: null, owner_ids: [2], online: true, exempt: false },
          { id: 2, name: 'Switch', vendor: null, owner_ids: [2], online: false, exempt: false },
          { id: 3, name: 'School laptop', vendor: null, owner_ids: [2], online: true, exempt: true },
        ]
      : p === '/chore-types' ? [{ id: 4, name: 'Schoolwork', glyph: 'school' }]
      : p === '/chores/' ? [{ id: 9, title: 'Homework', type_id: 4, assignments: [{ active: true, kid_ids: [2], repeat: { type: 'daily', days: [] } }] }]
      : [],
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
  expect(screen.getByText(/^Today .* · Feed the cat — late$/)).toBeInTheDocument()
  expect(screen.getByText(/^Today .* · Homework approved$/)).toBeInTheDocument()
  expect(await screen.findByText('Open')).toBeInTheDocument()
  expect(screen.getByText('Locked')).toBeInTheDocument()
  expect(screen.getByText('Exempt')).toBeInTheDocument()
  expect(screen.getByText('school')).toBeInTheDocument() // chore pill uses its type glyph
})
