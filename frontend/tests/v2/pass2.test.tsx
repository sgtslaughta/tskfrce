import { describe, expect, test } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fridgeTheme } from '@/v2/theme'
import { shortName } from '@/v2/components/DevicePill'
import { errorText, CANT_REACH } from '@/v2/errorText'
import { KidChecklist } from '@/v2/kid/KidChecklist'
import { LoadError } from '@/v2/components/States'
import { AccountMenu } from '@/v2/components/AccountMenu'
import type { KidChore } from '@/v2/types'

const wrap = (ui: unknown) => (
  <QueryClientProvider client={new QueryClient()}>
    <MantineProvider theme={fridgeTheme}>{ui as never}</MantineProvider>
  </QueryClientProvider>
)
const chore = (over: Partial<KidChore> = {}) =>
  ({ id: 7, title: 'Dishes', points: 5, state: 'todo', needs_photo: true, photo_count_current: 0, subtasks: [], ...over }) as KidChore

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

describe('kid chore rows', () => {
  test('waiting chore shows a status chip and one quiet chat button with an unread dot', () => {
    render(wrap(<KidChecklist chores={[chore({ state: 'needs_you' })]} unread={{ 7: 2 }} onChat={() => {}} />))
    expect(screen.getByText('Waiting for Mom or Dad')).toHaveClass('f-pill')
    expect(screen.getByRole('button', { name: 'Chat about Dishes, 2 unread' })).toHaveClass('f-iconbtn')
    expect(screen.queryByText('Chat')).toBeNull()
  })
  test('disabled Mark done says why', () => {
    render(wrap(<KidChecklist chores={[chore()]} onDone={() => {}} />))
    expect(screen.getByRole('button', { name: 'Mark done' })).toBeDisabled()
    expect(screen.getByText('Add a photo first')).toBeInTheDocument()
  })
  test('ready chore has no reason and an enabled button', () => {
    render(wrap(<KidChecklist chores={[chore({ photo_count_current: 1 })]} onDone={() => {}} />))
    expect(screen.getByRole('button', { name: 'Mark done' })).toBeEnabled()
    expect(screen.queryByText('Add a photo first')).toBeNull()
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
