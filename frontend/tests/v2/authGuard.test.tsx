import { beforeEach, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'

const replace = jest.fn()
jest.mock('next/router', () => ({ useRouter: () => ({ replace, asPath: '/hub?a=1' }) }))
jest.mock('@/contexts/UnifiedAuthContext', () => ({ useUnifiedAuth: jest.fn() }))

const auth = useUnifiedAuth as unknown as Mock<() => unknown>
const wrap = () =>
  render(
    <MantineProvider>
      <AuthGuard>
        <p>legacy</p>
      </AuthGuard>
    </MantineProvider>,
  )

beforeEach(() => {
  replace.mockReset()
})

test('logged out is sent to /login?next=', () => {
  auth.mockReturnValue({ isLoading: false, isAuthenticated: false })
  wrap()
  expect(replace).toHaveBeenCalledWith('/login?next=%2Fhub%3Fa%3D1')
  expect(screen.queryByText('legacy')).toBeNull()
})

test('logged in renders children', () => {
  auth.mockReturnValue({ isLoading: false, isAuthenticated: true })
  wrap()
  expect(screen.getByText('legacy')).toBeInTheDocument()
  expect(replace).not.toHaveBeenCalled()
})
