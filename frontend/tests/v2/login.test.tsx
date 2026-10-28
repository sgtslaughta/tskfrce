import React from 'react'
import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { fridgeTheme } from '@/v2/theme'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { api } from '@/v2/api'
import { footerText, LoginForm, safeNext } from '@/v2/login/LoginForm'

const replace = jest.fn()
const login = jest.fn()
let query: Record<string, string> = {}
jest.mock('next/router', () => ({ useRouter: () => ({ replace, query }) }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@/contexts/UnifiedAuthContext', () => ({ useUnifiedAuth: jest.fn() }))

const wrap = () =>
  render(
    <MantineProvider theme={fridgeTheme}>
      <LoginForm />
    </MantineProvider>,
  )
const fill = async () => {
  await userEvent.type(screen.getByLabelText(/Username/), 'admin')
  await userEvent.type(screen.getByLabelText(/Password/), 'secret')
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
}

beforeEach(() => {
  replace.mockReset()
  login.mockReset()
  query = {}
  ;(api as unknown as Mock<() => Promise<unknown>>).mockReset().mockResolvedValue({ needed: false })
  ;(useUnifiedAuth as unknown as Mock<() => unknown>).mockReturnValue({ login, isAuthenticated: false })
})

describe('LoginForm', () => {
  test('wrong password shows the message inline and does not log', async () => {
    const spy = jest.spyOn(console, 'error')
    login.mockRejectedValue(new Error("That username and password don't match.") as never)
    wrap()
    await fill()
    expect(await screen.findByRole('alert')).toHaveTextContent("That username and password don't match.")
    expect(replace).not.toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('success goes to ?next= exactly once', async () => {
    query = { next: '/devices' }
    const auth = useUnifiedAuth as unknown as Mock<() => unknown>
    login.mockImplementation((async () => {
      auth.mockReturnValue({ login, isAuthenticated: true })
    }) as never)
    const { rerender } = wrap()
    await fill()
    rerender(
      <MantineProvider theme={fridgeTheme}>
        <LoginForm />
      </MantineProvider>,
    )
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/devices'))
    expect(replace).toHaveBeenCalledTimes(1)
    expect(login).toHaveBeenCalledWith({ username: 'admin', password: 'secret', remember: true })
  })

  test('first-run box sends you to /setup', async () => {
    ;(api as unknown as Mock<() => Promise<unknown>>).mockResolvedValue({ needed: true })
    wrap()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/setup'))
  })

  test('safeNext only allows same-site paths', () => {
    expect(safeNext('/kids')).toBe('/kids')
    for (const bad of ['/\t/evil.com', '//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)'])
      expect(safeNext(bad)).toBe('/')
    expect(safeNext('/devices?focus=3')).toBe('/devices?focus=3')
    expect(safeNext('https://evil.com')).toBe('/')
    expect(safeNext(undefined)).toBe('/')
  })

  test('after a session expiry the login says to log in again (once)', async () => {
    sessionStorage.setItem('task4ce-session-expired', '1')
    wrap()
    expect(await screen.findByText(/Please log in again/)).toBeInTheDocument()
    expect(sessionStorage.getItem('task4ce-session-expired')).toBeNull()
  })

  test('login panel has no status or activity', () => {
    wrap()
    const container = document.querySelector('.p-auth-form-side') as HTMLElement
    expect(container.textContent).not.toMatch(/\bstatus\b/i)
    expect(container.textContent).not.toMatch(/\bactivity\b/i)
  })

  test('headline wifi on is a single nowrap span', () => {
    wrap()
    const headline = screen.getByText(/Chores done/)
    const em = headline.querySelector('em')
    expect(em).toBeInTheDocument()
    expect(em?.textContent).toContain('Wi‑Fi on')
    expect(em?.className).not.toContain('break-all')
  })

  test('kid card links to /kid', () => {
    wrap()
    const kidCard = screen.getByRole('link', { name: /I'm a kid/ })
    expect(kidCard).toHaveAttribute('href', '/kid')
  })

  test('forgot pane shows cli command', async () => {
    wrap()
    const forgotButton = screen.getByRole('button', { name: 'Forgot password?' })
    await userEvent.click(forgotButton)
    const cliText = await screen.findByText(/docker compose exec backend python -m app.cli reset-password/)
    expect(cliText).toBeInTheDocument()
  })
})

describe('footer', () => {
  test('shows version and box address', () => {
    expect(footerText('chores.local', '2.0.0')).toBe('t@sk4ce v2.0.0 · chores.local')
    expect(footerText('', undefined)).toBe('t@sk4ce')
  })
})

test('the session-expired note survives React strict mode running effects twice', async () => {
  sessionStorage.setItem('task4ce-session-expired', '1')
  render(
    <React.StrictMode>
      <MantineProvider theme={fridgeTheme}>
        <LoginForm />
      </MantineProvider>
    </React.StrictMode>,
  )
  expect(await screen.findByText('Please log in again.')).toBeInTheDocument()
})
