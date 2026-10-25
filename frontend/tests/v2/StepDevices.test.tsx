import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StepDevices } from '@/v2/setup/StepDevices'
import { api } from '@/v2/api'
import type { Device, Kid } from '@/v2/types'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
const apiMock = api as unknown as Mock<typeof api>

const kids = [{ id: 7, full_name: 'Mia', avatar: '🦊' }] as Kid[]
const dev = (o: Partial<Device>): Device =>
  ({ id: 1, name: 'Mias-iPad', mac: '3c:22:fb:00:00:01', vendor: 'Apple', status: 'unassigned', owner_ids: [], group_ids: [], online: true, override: null, last_seen: null, resisting: false, ip: '192.168.1.42', ...o }) as Device

const view = () =>
  render(
    <MantineProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <StepDevices kids={kids} />
      </QueryClientProvider>
    </MantineProvider>,
  )

beforeEach(() => apiMock.mockReset())

describe('StepDevices', () => {
  test('rows show name, maker and ip; Private MAC chip only for locally administered MACs', async () => {
    apiMock.mockResolvedValue([dev({}), dev({ id: 2, name: 'Unknown device', vendor: null, mac: '3a:1f:00:00:c2:09', ip: null })])
    view()
    expect(await screen.findByText('Mias-iPad')).toBeInTheDocument()
    expect(screen.getByText('Apple · 192.168.1.42')).toBeInTheDocument()
    expect(screen.getByText('Unknown maker')).toBeInTheDocument()
    expect(screen.getAllByText('Private MAC')).toHaveLength(1)
    expect(screen.getByText('Looking for devices… 2 found')).toBeInTheDocument()
  })

  test('picking a kid, then Guest, PATCHes the device with exact bodies', async () => {
    apiMock.mockImplementation(async (path, init) => (init?.method === 'PATCH' ? dev({}) : [dev({})]))
    view()
    const group = await screen.findByRole('group', { name: 'Owner of Mias-iPad' })
    await userEvent.click(group.querySelector('button') as HTMLElement)
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/devices/1', { method: 'PATCH', body: { status: 'assigned', owner_ids: [7] } }))
    await userEvent.click(screen.getByRole('button', { name: 'Guest' }))
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/devices/1', { method: 'PATCH', body: { status: 'guest', owner_ids: [] } }))
  })
})
