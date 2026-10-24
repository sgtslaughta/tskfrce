import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { api } from '@/v2/api'
import { BonusForm } from '@/v2/manage/BonusForm'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))

const apiMock = api as unknown as Mock<(p: string, i?: { method?: string; body?: unknown }) => Promise<unknown>>
const kid = { id: 3, full_name: 'Maya', username: 'maya', avatar: null, has_pin: false }

beforeEach(() => {
  apiMock.mockReset()
  apiMock.mockResolvedValue({ balance: 30 })
  ;(notifications.show as unknown as Mock).mockReset()
})

const setup = async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>
        <BonusForm kid={kid} />
      </MantineProvider>
    </QueryClientProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Give bonus points' }))
}

describe('BonusForm', () => {
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
})
