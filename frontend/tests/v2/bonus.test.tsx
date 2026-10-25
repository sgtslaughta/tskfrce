import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { api } from '@/v2/api'
import { PointsForm } from '@/v2/manage/PointsForm'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))

const apiMock = api as unknown as Mock<(p: string, i?: { method?: string; body?: unknown }) => Promise<unknown>>
const kid = { id: 3, full_name: 'Maya', username: 'maya', avatar: null, has_pin: false }

beforeEach(() => {
  apiMock.mockReset()
  apiMock.mockResolvedValue({ balance: 30 })
  ;(notifications.show as unknown as Mock).mockReset()
})

const onClose = jest.fn()
const setup = async (kind: 'bonus' | 'deduct' = 'bonus') => {
  onClose.mockReset()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>
        <PointsForm kid={kid} kind={kind} onClose={onClose} />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

describe('PointsForm', () => {
  test('needs amount 1-500 and a note', async () => {
    await setup()
    const send = screen.getByRole('button', { name: 'Send points' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    await userEvent.type(screen.getByLabelText(/Points/), '501')
    await userEvent.type(screen.getByLabelText('Why?'), 'Helped out')
    await waitFor(() => expect(send.disabled).toBe(true))
    await userEvent.clear(screen.getByLabelText(/Points/))
    await userEvent.type(screen.getByLabelText(/Points/), '0')
    expect(send.disabled).toBe(true)
  })

  test.each([['0', 'Must be at least 1.'], ['-5', 'Must be at least 1.'], ['501', 'Must be 500 or less.'], ['2.5', 'Use a whole number.'], ['abc', 'Numbers only.']])(
    'amount "%s" shows "%s" inline and sends nothing',
    async (value, msg) => {
      await setup()
      await userEvent.type(screen.getByLabelText(/Points/), value)
      await userEvent.type(screen.getByLabelText('Why?'), 'Helped out')
      expect(screen.getByText(msg)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Send points' })).toBeDisabled()
      expect(apiMock).not.toHaveBeenCalled()
    },
  )

  test('a failed send shows exactly one error toast', async () => {
    apiMock.mockRejectedValue(new Error('boom'))
    await setup()
    await userEvent.type(screen.getByLabelText(/Points/), '25')
    await userEvent.type(screen.getByLabelText('Why?'), 'Helped out')
    await userEvent.click(screen.getByRole('button', { name: 'Send points' }))
    await waitFor(() => expect(notifications.show).toHaveBeenCalledTimes(1))
  })

  test('posts the exact body and confirms', async () => {
    await setup()
    await userEvent.type(screen.getByLabelText(/Points/), '25')
    await userEvent.type(screen.getByLabelText('Why?'), '  Helped out ')
    await userEvent.click(screen.getByRole('button', { name: 'Send points' }))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/kids/3/points', { method: 'POST', body: { amount: 25, note: 'Helped out' } }),
    )
    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Sent! Maya got +25' })),
    )
  })

  test('closes after a successful send', async () => {
    await setup()
    await userEvent.type(screen.getByLabelText(/Points/), '25')
    await userEvent.type(screen.getByLabelText('Why?'), 'Helped out')
    await userEvent.click(screen.getByRole('button', { name: 'Send points' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  test('deduct presets −5 / −10 / −20 fill the amount; Custom clears it', async () => {
    await setup('deduct')
    await userEvent.click(screen.getByRole('button', { name: '−20' }))
    expect(screen.getByLabelText(/Points/)).toHaveValue('20')
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }))
    expect(screen.getByLabelText(/Points/)).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: '−10' }))
    await userEvent.type(screen.getByLabelText('Why?'), 'Broke a rule')
    await userEvent.click(screen.getByRole('button', { name: 'Take points' }))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/kids/3/deduct', { method: 'POST', body: { amount: 10, note: 'Broke a rule' } }),
    )
  })

  test('deduct posts to /deduct and reports what was taken', async () => {
    apiMock.mockResolvedValue({ balance: 5, deducted: 10 })
    await setup('deduct')
    await userEvent.type(screen.getByLabelText(/Points/), '30')
    await userEvent.type(screen.getByLabelText('Why?'), 'Broke a rule')
    await userEvent.click(screen.getByRole('button', { name: 'Take points' }))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/kids/3/deduct', { method: 'POST', body: { amount: 30, note: 'Broke a rule' } }),
    )
    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Maya lost 10 points' })),
    )
  })
})
