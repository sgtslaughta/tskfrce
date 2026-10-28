import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from '@jest/globals'
import { notifications } from '@mantine/notifications'
import { ApiError } from '@/v2/api'
import { toastFail, toastOk } from '@/v2/notify'

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
