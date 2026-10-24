import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Locker } from '@/v2/kid/Locker'
import { api } from '@/v2/api'
import { fridgeTheme } from '@/v2/theme'

jest.mock('@/v2/api', () => ({ ...(jest.requireActual('@/v2/api') as object), api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))

const apiMock = api as unknown as Mock<(p: string, i?: { method?: string; body?: unknown }) => Promise<unknown>>
const flair = {
  level: 8,
  equipped: { card: null, ring: null, name: null, emblem: null, title: null },
  items: [
    { id: 'card-sheen', slot: 'card', name: 'Sheen', unlock_level: 2, emblem: null, unlocked: true },
    { id: 'card-grid', slot: 'card', name: 'Grid', unlock_level: 4, emblem: null, unlocked: true },
    { id: 'card-gold', slot: 'card', name: 'Gold', unlock_level: 25, emblem: null, unlocked: false },
  ],
}
let putResp: object = { equipped: flair.equipped, new_badges: [] }

beforeEach(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as never
  apiMock.mockReset()
  ;(notifications.show as unknown as Mock<() => void>).mockClear()
  putResp = { equipped: flair.equipped, new_badges: [] }
  let eq = flair.equipped
  apiMock.mockImplementation(async (_p, i) => {
    if (i?.method !== 'PUT') return { ...flair, equipped: eq }
    const b = i.body as { slot: string; id: string | null }
    eq = { ...eq, [b.slot]: b.id }
    return putResp
  })
  window.matchMedia =
    window.matchMedia ||
    ((() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never)
})

const show = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider theme={fridgeTheme}>
        <Locker name="Maya" avatar="🦊" level={8} title="Pro" onClose={() => {}} />
      </MantineProvider>
    </QueryClientProvider>,
  )
}
const puts = () => apiMock.mock.calls.filter((c) => c[1]?.method === 'PUT')

describe('Locker', () => {
  test('locked item shows Lv and cannot be equipped', async () => {
    show()
    await userEvent.click(await screen.findByRole('button', { name: /Gold/ }))
    expect(screen.getByText('Lv 25')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Equip' })).toBeDisabled()
  })

  test('selecting previews before saving, Equip and Remove send the right body', async () => {
    const { container } = show()
    await userEvent.click(await screen.findByRole('button', { name: /Grid/ }))
    expect(container.querySelector('.flair-card-lg')).toHaveClass('flair-card-grid')
    expect(puts()).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Equip' }))
    await waitFor(() => expect(puts()[0][1]?.body).toEqual({ slot: 'card', id: 'card-grid' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(puts()[1][1]?.body).toEqual({ slot: 'card', id: null }))
  })

  test('new badges toast', async () => {
    putResp = { equipped: flair.equipped, new_badges: [{ name: 'Drip' }] }
    show()
    await userEvent.click(await screen.findByRole('button', { name: /Sheen/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Equip' }))
    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Badge unlocked: Drip' })),
    )
  })
})
