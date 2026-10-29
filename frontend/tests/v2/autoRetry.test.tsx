import { expect, jest, test } from '@jest/globals'
import { act, render, screen } from '@testing-library/react'
import { ErrorPanel } from '@/v2/parent/states'

test("can't-reach panel counts down and retries by itself", () => {
  jest.useFakeTimers()
  const retry = jest.fn()
  render(<ErrorPanel kind="unreachable" onRetry={retry} />)
  expect(screen.getByText('Retrying in 8s…')).toBeTruthy()
  act(() => jest.advanceTimersByTime(3000))
  expect(screen.getByText('Retrying in 5s…')).toBeTruthy()
  act(() => jest.advanceTimersByTime(5000))
  expect(retry).toHaveBeenCalledTimes(1)
  expect(screen.getByText('Retrying in 8s…')).toBeTruthy()
  jest.useRealTimers()
})
