import { describe, expect, test } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fridgeTheme } from '@/v2/theme'
import { shortName } from '@/v2/components/DevicePill'
import { errorText, CANT_REACH } from '@/v2/errorText'
import { LoadError } from '@/v2/components/States'
import { AccountMenu } from '@/v2/components/AccountMenu'

const wrap = (ui: unknown) => (
  <QueryClientProvider client={new QueryClient()}>
    <MantineProvider theme={fridgeTheme}>{ui as never}</MantineProvider>
  </QueryClientProvider>
)

describe('device short names', () => {
  test.each([
    ['task4ce-lab-kid1-1.home.lan', 'Kid1'],
    ['pixel-7.lan', 'Pixel 7'],
    ['192.168.1.20', '192.168.1.20'],
    ['Living-Room-Apple-TV-Extra', 'Living room a…'],
  ])('%s -> %s', (raw, want) => expect(shortName(raw)).toBe(want))
})

describe('errorText', () => {
  test('keeps our messages, replaces network failures', () => {
    expect(errorText(new Error('Pick a kid.'))).toBe('Pick a kid.')
    expect(errorText(new TypeError('Failed to fetch'))).toBe(CANT_REACH)
  })
  test('LoadError says what happened and offers a retry', async () => {
    const retry = jest.fn()
    render(wrap(<LoadError error={new TypeError('x')} onRetry={retry} />))
    expect(screen.getByRole('alert')).toHaveTextContent(CANT_REACH)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalled()
  })
})

describe('account menu', () => {
  test('opens Help, Settings and Log out', async () => {
    const out = jest.fn()
    render(wrap(<AccountMenu name="Dana" onLogout={out} />))
    await userEvent.click(screen.getByRole('button', { name: 'Account menu for Dana' }))
    expect(await screen.findByRole('menuitem', { name: 'Help', hidden: true })).toHaveAttribute('href', expect.stringContaining('?from=app'))
    expect(screen.getByText('Settings').closest('a')).toHaveAttribute('href', '/settings')
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Log out', hidden: true }))
    expect(out).toHaveBeenCalled()
  })
})
