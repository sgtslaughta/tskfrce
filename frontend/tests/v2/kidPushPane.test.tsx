import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { api } from '@/v2/api'
import { fridgeTheme } from '@/v2/theme'
import { KidPushPane } from '@/v2/manage/KidPushPane'
import { KidEditor } from '@/v2/manage/KidEditor'
import type { Kid } from '@/v2/types'

jest.mock('@/v2/api', () => ({ ...(jest.requireActual('@/v2/api') as object), api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))

const apiMock = api as unknown as Mock<(p: string, i?: { method?: string; body?: unknown }) => Promise<unknown>>
const wrap = (ui: unknown) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MantineProvider theme={fridgeTheme}>{ui as never}</MantineProvider>
  </QueryClientProvider>
)
const kid: Kid = { id: 7, full_name: 'Mia', username: 'mia', avatar: null, has_pin: false, age_group: 'kid' }
const fam = (relay: boolean) => ({ name: 'S', ntfy_upstream_relay: relay })
const push = (enabled: boolean) => ({ enabled, server: 'http://box:2586', topic: 'kid-abc', link: 'x', qr_svg: '<svg xmlns="http://www.w3.org/2000/svg"/>' })

const serve = (enabled: boolean, relay = false) =>
  apiMock.mockImplementation(async (p, i) => {
    if (p === '/kids') return [kid]
    if (p === '/family') return i?.method === 'PATCH' ? { ...fam(true) } : fam(relay)
    if (p === '/kids/7/push/reset') return push(true)
    if (p === '/kids/7/push') return push(enabled)
    return {}
  })

beforeEach(() => {
  apiMock.mockReset()
  window.matchMedia ??= ((() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never)
})

describe('KidPushPane', () => {
  test('shows QR, server and topic', async () => {
    serve(true)
    render(wrap(<KidPushPane />))
    const img = await screen.findByAltText('Kid phone code for Mia')
    expect(img.getAttribute('src')).toContain('data:image/svg+xml;utf8,')
    expect(screen.getByText('http://box:2586')).toBeInTheDocument()
    expect(screen.getByText('kid-abc')).toBeInTheDocument()
  })

  test('New code confirm posts the reset', async () => {
    serve(true)
    render(wrap(<KidPushPane />))
    await userEvent.click(await screen.findByRole('button', { name: /New code/ }))
    expect(await screen.findByText(/stops getting alerts until you scan the new code/)).toBeInTheDocument()
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'New code' }))
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/kids/7/push/reset', { method: 'POST' }))
  })

  test('disabled: copy shown, relay switch hidden', async () => {
    serve(false)
    render(wrap(<KidPushPane />))
    expect(await screen.findByText(/need the ntfy service on the box/)).toBeInTheDocument()
    expect(screen.queryByText(/Instant alerts on iPhones/)).toBeNull()
    expect(screen.queryByAltText(/Kid phone code/)).toBeNull()
  })

  test('relay switch reflects the setting and patches it', async () => {
    serve(true, false)
    render(wrap(<KidPushPane />))
    const sw = await screen.findByLabelText('Instant alerts on iPhones (relays through ntfy.sh)')
    expect(sw).not.toBeChecked()
    expect(screen.getByText(/passes through ntfy.sh. Off keeps everything in your home/)).toBeInTheDocument()
    await userEvent.click(sw)
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/family', { method: 'PATCH', body: { ntfy_upstream_relay: true } }))
  })
})

describe('KidEditor age group', () => {
  test('sends age_group only when changed', async () => {
    apiMock.mockResolvedValue({})
    render(wrap(<KidEditor kid={kid} />))
    expect(screen.getByRole('button', { name: /Kid \(9–12\)/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Save kid' }))
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/kids/7', { method: 'PATCH', body: {} }))
    apiMock.mockClear()
    await userEvent.click(screen.getByRole('button', { name: /Teen \(13\+\)/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Save kid' }))
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/kids/7', { method: 'PATCH', body: { age_group: 'teen' } }))
  })
})
