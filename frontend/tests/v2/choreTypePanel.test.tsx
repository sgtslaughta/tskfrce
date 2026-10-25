import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fridgeTheme } from '@/v2/theme'
import { api } from '@/v2/api'
import { ChoreTypePanel } from '@/v2/manage/ChoreTypePanel'
import type { ChoreType } from '@/v2/types'

jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))

const apiMock = api as unknown as Mock<(p: string, init?: { method?: string; body?: unknown }) => Promise<unknown>>
const calls = (method: string) => apiMock.mock.calls.filter(([, i]) => i?.method === method)

const pets: ChoreType = { id: 2, name: 'Pets', glyph: 'pets', builtin: true, notes: [{ id: 1, label: 'Out of pet food', glyph: 'pets' }], chore_count: 3 }

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never
})
beforeEach(() => {
  apiMock.mockReset().mockImplementation(async (_p, init) => (init?.method === 'POST' ? { ...pets, id: 9, builtin: false } : {}))
})

const panel = (type?: ChoreType, onSaved = jest.fn()) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider theme={fridgeTheme}>
        <ChoreTypePanel opened type={type} onClose={jest.fn()} onSaved={onSaved} />
      </MantineProvider>
    </QueryClientProvider>,
  )

describe('chore type panel', () => {
  test('create sends name, glyph and notes, then hands back the new type', async () => {
    const onSaved = jest.fn()
    panel(undefined, onSaved)
    expect(await screen.findByText('Added to every type')).toBeInTheDocument()
    expect(screen.getByText('Need help')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Name'), 'Laundry')
    await userEvent.click(screen.getByTitle('local_laundry_service'))
    for (const n of ['Out of detergent', 'Washer is full']) await userEvent.type(screen.getByLabelText('Add a note'), `${n}{Enter}`)
    await userEvent.click(screen.getByRole('button', { name: 'Move up Washer is full' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create type' }))
    await waitFor(() =>
      expect(calls('POST')[0]).toEqual([
        '/chore-types',
        { method: 'POST', body: { name: 'Laundry', glyph: 'local_laundry_service', notes: ['Washer is full', 'Out of detergent'] } },
      ]),
    )
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 9 })))
  })

  test('a built-in type in edit mode saves with PATCH and has no Delete', async () => {
    panel(pets)
    expect(await screen.findByLabelText('Name')).toHaveValue('Pets')
    expect(screen.queryByRole('button', { name: 'Delete type' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Remove Out of pet food' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save type' }))
    await waitFor(() => expect(calls('PATCH')[0]).toEqual(['/chore-types/2', { method: 'PATCH', body: { name: 'Pets', glyph: 'pets', notes: [] } }]))
  })

  test('a custom type can be deleted after a confirm that says where its chores go', async () => {
    panel({ ...pets, id: 9, name: 'Laundry', builtin: false })
    await userEvent.click(await screen.findByRole('button', { name: 'Delete type' }))
    expect(await screen.findByText('Chores of this type move to Other.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(calls('DELETE')[0]).toEqual(['/chore-types/9', { method: 'DELETE' }]))
  })
})
