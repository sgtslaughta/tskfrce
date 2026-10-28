import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from '@jest/globals'
import { notifications } from '@mantine/notifications'
import { ApiError } from '@/v2/api'
import { retryIfOffline, toastFail, toastOk } from '@/v2/notify'

jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn(), hide: jest.fn() } }))

test('view-as-kid refusal is a neutral toast, not an error', () => {
  toastFail(new ApiError(403, 'Preview only. Log in as Bobby to do this.'))
  const arg = (notifications.show as unknown as { mock: { calls: [Record<string, unknown>][] } }).mock.calls[0][0]
  expect(arg).toMatchObject({ message: 'Preview only. Log in as Bobby to do this.' })
  expect(arg.title).toBeUndefined()
  expect(arg.color).not.toBe('fridgeRed')
})

test('the Undo button closes its toast first', async () => {
  const undo = jest.fn()
  toastOk('Locked', { undo })
  const arg = (notifications.show as unknown as { mock: { calls: [{ id: string; message: React.ReactElement }][] } }).mock.calls.at(-1)![0]
  render(arg.message)
  await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
  expect(notifications.hide).toHaveBeenCalledWith(arg.id)
  expect(undo).toHaveBeenCalledTimes(1)
})

const lastToast = () =>
  (notifications.show as unknown as { mock: { calls: [{ id: string; message: React.ReactElement | string }][] } }).mock.calls.at(-1)![0]

test('an error toast without retry has no button', () => {
  toastFail(new Error('Nope'))
  expect(lastToast().message).toBe('Nope')
})

test('the Retry button closes its toast first and re-runs once', async () => {
  const retry = jest.fn()
  toastFail(new Error('Nope'), retry)
  const arg = lastToast()
  render(arg.message as React.ReactElement)
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(notifications.hide).toHaveBeenCalledWith(arg.id)
  expect(retry).toHaveBeenCalledTimes(1)
})

test('react-query variables passed as 2nd arg are not mistaken for a retry', () => {
  ;(toastFail as (e: unknown, v: unknown) => void)(new Error('Nope'), { id: 1 })
  expect(lastToast().message).toBe('Nope')
})

test('retryIfOffline only offers retry when the request never arrived', () => {
  const fn = jest.fn()
  expect(retryIfOffline(new TypeError('Failed to fetch'), fn)).toBe(fn)
  expect(retryIfOffline(new ApiError(500, 'boom'), fn)).toBeUndefined()
})
