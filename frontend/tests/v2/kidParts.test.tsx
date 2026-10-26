import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { TellParentSheet } from '@/v2/kid/TellParent'
import { KidSteps } from '@/v2/kid/KidSteps'
import { DeductionCards } from '@/v2/kid/ChoreParts'
import { api } from '@/v2/api'
import { fridgeTheme } from '@/v2/theme'
import type { KidChore } from '@/v2/types'

jest.mock('@/v2/api', () => ({ ...(jest.requireActual('@/v2/api') as object), api: jest.fn() }))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))
const apiMock = api as unknown as Mock<(p: string, i?: { method?: string; body?: unknown }) => Promise<unknown>>

const wrap = (ui: unknown) => (
  <QueryClientProvider client={new QueryClient()}>
    <MantineProvider theme={fridgeTheme}>{ui as never}</MantineProvider>
  </QueryClientProvider>
)
const n = (label: string, universal = false) => ({ label, glyph: universal ? 'help' : 'cleaning_services', universal })
const chore = (over: Partial<KidChore> = {}) =>
  ({
    id: 7, title: 'Clean the bathroom', points: 40, state: 'todo',
    subtasks: [
      { id: 1, title: 'Sink', done: true, after_previous: false },
      { id: 2, title: 'Mirror', done: false, after_previous: true },
      { id: 3, title: 'Floor', done: false, locked: true, after_previous: true },
    ],
    notes: [n('Out of supplies'), n('Did part of it'), n('Too messy for one go'), n('Need help', true), n('Ran out of time', true), n("Can't do it today", true)],
    ...over,
  }) as KidChore

beforeEach(() => apiMock.mockReset().mockResolvedValue(undefined))

describe('TellParentSheet', () => {
  test('lists type and universal notes, names the chore, and Send posts label and text', async () => {
    render(wrap(<TellParentSheet c={chore()} opened onClose={() => {}} />))
    expect(await screen.findByText('About: Clean the bathroom')).toBeInTheDocument()
    for (const l of ['Out of supplies', 'Did part of it', 'Too messy for one go', 'Need help', 'Ran out of time', "Can't do it today"])
      expect(screen.getByRole('button', { name: new RegExp(l) })).toBeInTheDocument()
    const send = screen.getByRole('button', { name: /Send/ })
    expect(send).toBeDisabled()
    const b = screen.getByRole('button', { name: /Need help/ })
    await userEvent.click(b)
    expect(b).toHaveAttribute('aria-pressed', 'true')
    await userEvent.type(screen.getByLabelText('Add a note (optional)'), 'soap')
    await userEvent.click(send)
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/kid/chores/7/note', expect.objectContaining({ method: 'POST', body: { label: 'Need help', text: 'soap' } })),
    )
  })
})

describe('KidSteps', () => {
  test('locked step is disabled with its unlock hint; next step says do this next', () => {
    render(wrap(<KidSteps c={chore()} />))
    expect(screen.getByRole('checkbox', { name: 'Floor' })).toBeDisabled()
    expect(screen.getByText('Unlocks after step 2')).toBeInTheDocument()
    expect(screen.getByText('Do this next')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Mirror' })).toBeEnabled()
  })
  test('readOnly disables every step', () => {
    render(wrap(<KidSteps c={chore()} readOnly />))
    expect(screen.getByRole('checkbox', { name: 'Mirror' })).toBeDisabled()
  })
})

describe('DeductionCards', () => {
  const d = [{ amount: 10, note: 'Left a mess', by_name: 'Dad', at: '' }]
  test('no Reply without onReply', () => {
    render(wrap(<DeductionCards c={chore({ deductions: d })} />))
    expect(screen.getByText('Dad took 10 points')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reply/ })).toBeNull()
  })
  test('Reply calls onReply', async () => {
    const onReply = jest.fn()
    render(wrap(<DeductionCards c={chore({ deductions: d })} onReply={onReply} />))
    await userEvent.click(screen.getByRole('button', { name: /Reply/ }))
    expect(onReply).toHaveBeenCalled()
  })
})

test('no @tabler imports under src/v2/kid', () => {
  const dir = join(__dirname, '../../src/v2/kid')
  const files = readdirSync(dir, { recursive: true }) as string[]
  const hits = files.filter((f) => /\.tsx?$/.test(f) && readFileSync(join(dir, f), 'utf8').includes('@tabler'))
  expect(hits).toEqual([])
})
