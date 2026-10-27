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
const INFO = {
  username: 'dad',
  inviter: 'Mom',
  family_name: 'The Garcias',
  expires_at: new Date(Date.now() + 22 * 3600_000 + 60_000).toISOString(),
}
const TOKEN = 'tok'
const invite = () => TOKEN
const wrap = async (token?: string) => {
  const r = render(
    <MantineProvider theme={fridgeTheme}>
      <RegisterForm token={token} />
    </MantineProvider>,
  )
  if (token) await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  return r
}

beforeEach(() => {
  replace.mockReset()
  login.mockReset().mockResolvedValue(null as never)
  apiMock.mockReset().mockResolvedValue(INFO)
  ;(useUnifiedAuth as unknown as Mock<() => unknown>).mockReturnValue({ login })
})

describe('RegisterForm', () => {
  test('redeems the invite, logs in and goes home', async () => {
    await wrap(invite())
    apiMock.mockResolvedValue({ user_id: 3, username: 'dad' })
    await userEvent.type(screen.getByLabelText('Your name'), 'Dad')
    await userEvent.type(screen.getByLabelText(/Choose a password/), 'longenough')
    await userEvent.type(screen.getByLabelText('Type it again'), 'longenough')
    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(apiMock).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: { token: TOKEN, password: 'longenough', full_name: 'Dad' },
    })
    expect(login).toHaveBeenCalledWith({ username: 'dad', password: 'longenough' })
  })

  test('shows the backend detail inline', async () => {
    await wrap(invite())
    apiMock.mockRejectedValue(new Error('Ask a parent to add you.'))
    await userEvent.type(screen.getByLabelText(/Choose a password/), 'longenough')
    await userEvent.type(screen.getByLabelText('Type it again'), 'longenough')
    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ask a parent to add you.')
    expect(replace).not.toHaveBeenCalled()
  })

  test('says who invited you to which family, and when it expires', async () => {
    await wrap(invite())
    expect(apiMock).toHaveBeenCalledWith('/auth/invite/tok')
    expect(screen.getByText('Mom invited you to The Garcias.')).toBeInTheDocument()
    expect(screen.getByText('Invite from Mom')).toBeInTheDocument()
    expect(screen.getByText('Expires in 22 hours')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toHaveValue('dad')
    expect(screen.getByLabelText('Username')).toHaveAttribute('readonly')
  })

  test.each([
    ['expired or used', { status: 410 }],
    ['garbled', { status: 404 }],
  ])('a %s invite shows the expired panel on open, not the form', async (_n, err) => {
    apiMock.mockRejectedValue(err)
    render(
      <MantineProvider theme={fridgeTheme}>
        <RegisterForm token="x" />
      </MantineProvider>,
    )
    expect(await screen.findByText('This invite has expired')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to log in/i })).toHaveAttribute('href', '/login')
    expect(screen.queryByLabelText(/Choose a password/)).not.toBeInTheDocument()
  })

  test('if the box does not answer the check, the form still shows', async () => {
    apiMock.mockRejectedValue(new TypeError('network'))
    await wrap(invite())
    await screen.findByLabelText(/Choose a password/)
  })

  test('missing token explains itself', async () => {
    await wrap(undefined)
    expect(screen.getByRole('alert')).toHaveTextContent('missing its code')
  })

  test('mismatched passwords show inline and block the join', async () => {
    await wrap(invite())
    await userEvent.type(screen.getByLabelText(/Choose a password/), 'longenough')
    await userEvent.type(screen.getByLabelText('Type it again'), 'longer')
    expect(screen.getByText("The two passwords don't match.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(apiMock).not.toHaveBeenCalledWith('/auth/register', expect.anything())
  })

  test('register form shows password strength indicator', async () => {
    await wrap(invite())
    const form = document.querySelector('.p-auth-form') as HTMLElement
    const segments = form.querySelectorAll('.p-auth-strength i')
    expect(segments.length).toBeGreaterThanOrEqual(4)
  })
})
