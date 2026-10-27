import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fridgeTheme } from '@/v2/theme'
import { api } from '@/v2/api'
import { ResetForm } from '@/v2/login/ResetForm'

const replace = jest.fn()
jest.mock('next/router', () => ({ useRouter: () => ({ replace }) }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))
const apiMock = api as unknown as Mock<(p: string, i?: unknown) => Promise<unknown>>

const wrap = (ui: React.ReactNode) =>
  render(
    <MantineProvider theme={fridgeTheme}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {ui}
      </QueryClientProvider>
    </MantineProvider>,
  )

beforeEach(() => {
  replace.mockReset()
  apiMock.mockReset().mockImplementation(async (p) => {
    if (p.startsWith('/auth/reset/')) return undefined // link check: still good
    return undefined
  })
})

const shown = async (token = 'tok') => {
  wrap(<ResetForm token={token} />)
  await screen.findByLabelText(/New password/)
}

describe('ResetForm', () => {
  test('validates length and match before calling the api', async () => {
    await shown()
    await userEvent.type(screen.getByLabelText(/New password/), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 8')
    await userEvent.clear(screen.getByLabelText(/New password/))
    await userEvent.type(screen.getByLabelText(/New password/), 'longenough')
    await userEvent.type(screen.getByLabelText('Type it again'), 'different1')
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('do not match')
    expect(apiMock).not.toHaveBeenCalledWith('/auth/reset', expect.anything())
  })

  test('success goes to login', async () => {
    await shown()
    await userEvent.type(screen.getByLabelText(/New password/), 'longenough')
    await userEvent.type(screen.getByLabelText('Type it again'), 'longenough')
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?reset=1'))
    expect(apiMock).toHaveBeenCalledWith('/auth/reset', {
      method: 'POST',
      body: { token: 'tok', password: 'longenough' },
    })
  })

  test('expired link shows the backend message', async () => {
    await shown()
    apiMock.mockRejectedValue(new Error('That reset link has expired. Ask for a new one.'))
    await userEvent.type(screen.getByLabelText(/New password/), 'longenough')
    await userEvent.type(screen.getByLabelText('Type it again'), 'longenough')
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('has expired')
  })

  test('a used or stale link shows the expired panel on open', async () => {
    apiMock.mockRejectedValue({ status: 400 })
    wrap(<ResetForm token="old" />)
    expect(await screen.findByText('This reset link has expired')).toBeInTheDocument()
    expect(apiMock).toHaveBeenCalledWith('/auth/reset/old')
    expect(screen.queryByLabelText(/New password/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to log in/i })).toHaveAttribute('href', '/login')
  })

  test('if the box does not answer the check, the form still shows', async () => {
    apiMock.mockRejectedValue(new TypeError('network'))
    await shown()
  })

  test('mismatch shows inline as you type', async () => {
    await shown()
    await userEvent.type(screen.getByLabelText(/New password/), 'longenough')
    await userEvent.type(screen.getByLabelText('Type it again'), 'long')
    expect(screen.getByText("The two passwords don't match.")).toBeInTheDocument()
  })

  test('missing token explains itself', () => {
    wrap(<ResetForm token={undefined} />)
    expect(screen.getByRole('alert')).toHaveTextContent('missing its code')
  })

  test('reset form has no status or activity elements', async () => {
    await shown()
    const container = document.querySelector('.p-auth-form-side') as HTMLElement
    expect(container.textContent).not.toMatch(/\bstatus\b/i)
    expect(container.textContent).not.toMatch(/\bactivity\b/i)
  })

  test('password fields support show/hide toggle', async () => {
    await shown()
    const passwordInput = screen.getByLabelText(/New password/)
    expect(passwordInput).toHaveAttribute('type', 'password')
    const showButton = screen.getAllByRole('button').find((b) => b.className?.includes('p-auth-link'))
    if (showButton) {
      await userEvent.click(showButton)
      expect(passwordInput).toHaveAttribute('type', 'text')
    }
  })
})
