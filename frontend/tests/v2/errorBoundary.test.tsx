import { expect, test } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { ErrorBoundary } from '@/v2/components/ErrorBoundary'

const Boom = ({ boom }: { boom: boolean }) => {
  if (boom) throw new Error('bad payload')
  return <p>fine</p>
}
const wrap = (boom: boolean, resetKey: string) => (
  <MantineProvider>
    <ErrorBoundary resetKey={resetKey}>
      <Boom boom={boom} />
    </ErrorBoundary>
  </MantineProvider>
)

test('a render error shows the calm crash page with Reload and Copy details', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const writeText = jest.fn(async () => {})
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  render(wrap(true, '/a'))
  expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Reload/ })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Copy details/ }))
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining('bad payload'))
})

test('navigating to another route clears the error', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const { rerender } = render(wrap(true, '/a'))
  expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  rerender(wrap(false, '/b'))
  expect(screen.getByText('fine')).toBeInTheDocument()
})
