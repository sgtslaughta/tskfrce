import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fridgeTheme } from '@/v2/theme'
import { api } from '@/v2/api'
import { ResetForm } from '@/v2/login/ResetForm'
import { ParentsList } from '@/v2/manage/ParentsList'

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
  apiMock.mockReset()
})

describe('ResetForm', () => {
  test('validates length and match before calling the api', async () => {
    wrap(<ResetForm token="tok" />)
    await userEvent.type(screen.getByLabelText(/New password/), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 8')
    await userEvent.clear(screen.getByLabelText(/New password/))
    await userEvent.type(screen.getByLabelText(/New password/), 'longenough')
    await userEvent.type(screen.getByLabelText('Type it again'), 'different1')
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('do not match')
    expect(apiMock).not.toHaveBeenCalled()
  })

  test('success goes to login', async () => {
    apiMock.mockResolvedValue(undefined)
    wrap(<ResetForm token="tok" />)
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
    apiMock.mockRejectedValue(new Error('That reset link has expired. Ask for a new one.'))
    wrap(<ResetForm token="tok" />)
    await userEvent.type(screen.getByLabelText(/New password/), 'longenough')
    await userEvent.type(screen.getByLabelText('Type it again'), 'longenough')
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('has expired')
  })

  test('missing token explains itself', () => {
    wrap(<ResetForm token={undefined} />)
    expect(screen.getByRole('alert')).toHaveTextContent('missing its code')
  })

  test('reset form has no status or activity elements', () => {
    wrap(<ResetForm token="tok" />)
    const container = document.querySelector('.p-auth-form-side') as HTMLElement
    expect(container.textContent).not.toMatch(/\bstatus\b/i)
    expect(container.textContent).not.toMatch(/\bactivity\b/i)
  })

  test('password fields support show/hide toggle', async () => {
    wrap(<ResetForm token="tok" />)
    const passwordInput = screen.getByLabelText(/New password/)
    expect(passwordInput).toHaveAttribute('type', 'password')
    const showButton = screen.getAllByRole('button').find((b) => b.className?.includes('p-auth-link'))
    if (showButton) {
      await userEvent.click(showButton)
      expect(passwordInput).toHaveAttribute('type', 'text')
    }
  })
})

describe('ParentsList', () => {
  test('other parents get a reset link with a copy button; you do not', async () => {
    apiMock.mockImplementation(async (p) =>
      p === '/parents'
        ? [
            { id: 1, username: 'mom', full_name: 'Mom', is_me: true },
            { id: 2, username: 'dad', full_name: 'Dad', is_me: false },
          ]
        : { url: 'http://box:3000/reset?token=abc' },
    )
    wrap(<ParentsList />)
    expect(await screen.findByText('Dad')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Reset password' })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))
    expect(await screen.findByLabelText('Reset link')).toHaveValue('http://box:3000/reset?token=abc')
    expect(screen.getByText(/Send this to Dad. It works once, for 30 minutes./)).toBeInTheDocument()
    expect(apiMock).toHaveBeenCalledWith('/parents/2/reset-link', { method: 'POST' })
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
  })
})
