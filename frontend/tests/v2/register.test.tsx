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
    wrap('tok')
    await userEvent.type(screen.getByLabelText('Your name'), 'Dad')
    await userEvent.type(screen.getByLabelText(/Choose a password/), 'longenough')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(apiMock).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: { token: 'tok', password: 'longenough', full_name: 'Dad' },
    })
    expect(login).toHaveBeenCalledWith({ username: 'dad', password: 'longenough' })
  })

  test('shows the backend detail inline', async () => {
    apiMock.mockRejectedValue(new Error('Ask a parent to add you.'))
    wrap('tok')
    await userEvent.type(screen.getByLabelText(/Choose a password/), 'longenough')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ask a parent to add you.')
    expect(replace).not.toHaveBeenCalled()
  })

  test('missing token explains itself', () => {
    wrap(undefined)
    expect(screen.getByRole('alert')).toHaveTextContent('missing its code')
  })
})
