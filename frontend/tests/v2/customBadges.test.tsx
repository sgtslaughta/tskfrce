import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { CustomBadgesPanel } from '@/v2/manage/CustomBadgesPanel'
import { api } from '@/v2/api'
import { fridgeTheme } from '@/v2/theme'
import { notifications } from '@mantine/notifications'

jest.mock('@/v2/api', () => ({
  ...(jest.requireActual('@/v2/api') as object),
  api: jest.fn(),
}))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))

const apiMock = api as unknown as Mock<(p: string, i?: { method?: string; body?: unknown }) => Promise<unknown>>
const routes: Record<string, unknown> = {
  'GET /custom-badges': [{ id: 3, name: 'Helper', icon: '🤝', description: 'Helped out' }],
  'GET /kids': [{ id: 1, full_name: 'Ana', username: 'ana', avatar: null, has_pin: false }],
  'POST /custom-badges': {},
  'POST /custom-badges/3/award': { tier: 2 },
}
const calls = (p: string) => apiMock.mock.calls.filter((c) => c[0] === p)

beforeEach(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as never
  apiMock.mockReset()
  ;(notifications.show as unknown as Mock).mockReset()
  apiMock.mockImplementation(async (p, i) => {
    const k = `${i?.method ?? 'GET'} ${p}`
    if (!(k in routes)) throw new Error(`unrouted ${k}`)
    return routes[k]
  })
  window.matchMedia =
    window.matchMedia ||
    ((() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never)
})

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MantineProvider theme={fridgeTheme}>
        <CustomBadgesPanel />
      </MantineProvider>
    </QueryClientProvider>,
  )

describe('CustomBadgesPanel', () => {
  test('create posts name, icon, description', async () => {
    wrap()
    await screen.findByRole('button', { name: 'Award Helper' })
    await userEvent.type(screen.getByLabelText('Badge name'), 'Kind')
    await userEvent.type(screen.getByLabelText('Emoji'), '💛')
    await userEvent.type(screen.getByLabelText('Description'), 'Was kind')
    await userEvent.click(screen.getByRole('button', { name: 'Add badge' }))
    expect(calls('/custom-badges').find((c) => c[1]?.method === 'POST')?.[1]).toMatchObject({
      body: { name: 'Kind', icon: '💛', description: 'Was kind' },
    })
  })

  test('award posts kid_id and toasts the new tier', async () => {
    wrap()
    await userEvent.click(await screen.findByRole('textbox', { name: 'Award to' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Ana', hidden: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Award Helper' }))
    expect(calls('/custom-badges/3/award')[0][1]).toMatchObject({ method: 'POST', body: { kid_id: 1 } })
    await waitFor(() => expect(JSON.stringify((notifications.show as unknown as Mock).mock.calls)).toContain('silver'))
  })
})
