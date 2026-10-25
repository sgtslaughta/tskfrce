import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { fridgeTheme } from '@/v2/theme'
import { api } from '@/v2/api'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { RegisterForm } from '@/v2/login/RegisterForm'

const replace = jest.fn()
const login = jest.fn()
jest.mock('next/router', () => ({ useRouter: () => ({ replace }) }))
jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@/contexts/UnifiedAuthContext', () => ({ useUnifiedAuth: jest.fn() }))

const apiMock = api as unknown as Mock<(p: string, i?: unknown) => Promise<unknown>>
/** An invite token shaped like the server's JWT: only `sub` and `exp` are read client-side. */
const invite = (hours = 24, sub = 'dad') =>
  `h.${btoa(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + hours * 3600 })).replace(/=+$/, '')}.s`
const wrap = (token?: string) =>
  render(
    <MantineProvider theme={fridgeTheme}>
      <RegisterForm token={token} />
    </MantineProvider>,
  )

beforeEach(() => {
  replace.mockReset()
  login.mockReset().mockResolvedValue(null as never)
  apiMock.mockReset()
  ;(useUnifiedAuth as unknown as Mock<() => unknown>).mockReturnValue({ login })
})

describe('RegisterForm', () => {
  test('redeems the invite, logs in and goes home', async () => {
    apiMock.mockResolvedValue({ user_id: 3, username: 'dad' })
    const tok = invite()
    wrap(tok)
    await userEvent.type(screen.getByLabelText('Your name'), 'Dad')
    await userEvent.type(screen.getByLabelText(/Choose a password/), 'longenough')
    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(apiMock).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: { token: tok, password: 'longenough', full_name: 'Dad' },
    })
    expect(login).toHaveBeenCalledWith({ username: 'dad', password: 'longenough' })
  })

  test('shows the backend detail inline', async () => {
    apiMock.mockRejectedValue(new Error('Ask a parent to add you.'))
    wrap(invite())
    await userEvent.type(screen.getByLabelText(/Choose a password/), 'longenough')
    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ask a parent to add you.')
    expect(replace).not.toHaveBeenCalled()
  })

  test('shows who the invite is for and when it expires, from the token itself', () => {
    const exp = Math.floor(Date.now() / 1000) + 5 * 3600 + 60
    const payload = btoa(JSON.stringify({ sub: 'grandma', exp })).replace(/=+$/, '')
    wrap(`h.${payload}.s`)
    expect(screen.getByText('Invite for grandma')).toBeInTheDocument()
    expect(screen.getByText('Expires in 5 hours')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toHaveValue('grandma')
    expect(screen.getByLabelText('Username')).toHaveAttribute('readonly')
  })

  test.each([
    ['expired', invite(-2)],
    ['garbled', 'not-a-token'],
  ])('a %s invite shows the expired panel, not the form', (_n, tok) => {
    wrap(tok)
    expect(screen.getByText('This invite has expired')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to log in/i })).toHaveAttribute('href', '/login')
    expect(screen.queryByLabelText(/Choose a password/)).not.toBeInTheDocument()
  })

  test('missing token explains itself', () => {
    wrap(undefined)
    expect(screen.getByRole('alert')).toHaveTextContent('missing its code')
  })

  test('register form shows password strength indicator', () => {
    wrap(invite())
    const form = document.querySelector('.p-auth-form') as HTMLElement
    const segments = form.querySelectorAll('.p-auth-strength i')
    expect(segments.length).toBeGreaterThanOrEqual(4)
  })

  test('no hardcoded invite details shown', () => {
    wrap(invite())
    expect(screen.queryByText(/Dad invited you/)).not.toBeInTheDocument()
    expect(screen.queryByText(/The Garcias/)).not.toBeInTheDocument()
  })
})
