import { describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '@/v2/api'
import { ParentsPane } from '@/v2/manage/ParentsPane'

jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))
const apiMock = api as unknown as Mock<(p: string, i?: { method?: string }) => Promise<unknown>>

const wrap = () =>
  render(
    <MantineProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ParentsPane />
      </QueryClientProvider>
    </MantineProvider>,
  )

const serve = (invites: unknown[]) =>
  apiMock.mockImplementation(async (p, i) => {
    if (p === '/parents')
      return [
        { id: 1, username: 'dad', full_name: 'Dad', is_me: true, is_owner: true },
        { id: 2, username: 'mom', full_name: 'Mom', is_me: false, is_owner: false },
      ]
    if (p === '/users/invites' && !i) return invites
    if (p === '/parents/2/reset-link') return { url: 'http://box:3000/reset?token=abc' }
    if (p === '/users/invite') return { token: 'tok', expires_in: 86400 }
    return undefined
  })

describe('ParentsPane', () => {
  test('owner chip; reset link only for the other parent', async () => {
    serve([])
    wrap()
    expect(await screen.findByText('Mom')).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Reset link' })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Reset link' }))
    expect(await screen.findByLabelText('Reset link')).toHaveValue('http://box:3000/reset?token=abc')
    expect(screen.getByText(/Send this to Mom. It works once, for 30 minutes./)).toBeInTheDocument()
  })

  test('pending invites list with Cancel', async () => {
    serve([{ jti: 'j1', username: 'grandma', expires_in: 7200 }])
    wrap()
    const row = (await screen.findByText('grandma')).closest('.pn-par') as HTMLElement
    expect(within(row).getByText('Invite sent · expires in 2 h')).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'Cancel invite for grandma' }))
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/users/invites/j1', { method: 'DELETE' }))
  })

  test('Invite a parent makes a link that says 24 hours', async () => {
    serve([])
    wrap()
    await userEvent.click(await screen.findByRole('button', { name: 'Invite a parent' }))
    await userEvent.type(screen.getByLabelText('Their username'), 'grandma')
    await userEvent.click(screen.getByRole('button', { name: 'Create invite link' }))
    expect(await screen.findByLabelText('Invite link')).toHaveValue(`${window.location.origin}/register?token=tok`)
    expect(screen.getByText('The link works once and expires in 24 hours.')).toBeInTheDocument()
  })

  test('a fresh invite reads 24 h and Create is off until the name changes', async () => {
    serve([{ jti: 'j1', username: 'grandma', expires_in: 86397 }])
    wrap()
    expect(await screen.findByText('Invite sent · expires in 24 h')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Invite a parent' }))
    await userEvent.type(screen.getByLabelText('Their username'), 'grandma')
    await userEvent.click(screen.getByRole('button', { name: 'Create invite link' }))
    await screen.findByLabelText('Invite link')
    expect(screen.getByRole('button', { name: 'Create invite link' })).toBeDisabled()
  })
})

describe('ParentsPane states and cancel', () => {
  test('error shows a retry panel, not an empty card', async () => {
    apiMock.mockRejectedValue(new Error('down'))
    wrap()
    expect(await screen.findByRole('button', { name: /Try again/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Parents' })).toBeNull()
  })

  test('cancelling the invite just made clears its link and re-enables Create', async () => {
    let invites: unknown[] = []
    serve([])
    const base = apiMock.getMockImplementation()!
    apiMock.mockImplementation(async (p, i) => {
      if (p === '/users/invites' && !i) return invites
      if (p === '/users/invite') { invites = [{ jti: 'j9', username: 'grandma', expires_in: 86400 }]; return { token: 'tok', expires_in: 86400 } }
      if (p === '/users/invites/j9') { invites = []; return undefined }
      return base(p, i)
    })
    wrap()
    await userEvent.click(await screen.findByRole('button', { name: 'Invite a parent' }))
    await userEvent.type(screen.getByLabelText('Their username'), 'grandma')
    await userEvent.click(screen.getByRole('button', { name: 'Create invite link' }))
    await screen.findByLabelText('Invite link')
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel invite for grandma' }))
    await waitFor(() => expect(screen.queryByLabelText('Invite link')).toBeNull())
    expect(screen.getByRole('button', { name: 'Create invite link' })).toBeEnabled()
  })
})
