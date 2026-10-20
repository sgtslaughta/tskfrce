import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { fridgeTheme } from '@/v2/theme'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { api } from '@/v2/api'
import { LoginForm, safeNext } from '@/v2/login/LoginForm'

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
    login.mockRejectedValue(new Error('Incorrect username or password') as never)
    wrap()
    await fill()
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password')
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
    expect(login).toHaveBeenCalledWith({ username: 'admin', password: 'secret' })
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
})
