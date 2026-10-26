import { beforeEach, describe, expect, test } from '@jest/globals'
import type { Mock } from 'jest-mock'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { KidPage } from '@/v2/kid/KidPage'
import { api, ApiError, AuthError, KID_TOKEN_KEY } from '@/v2/api'
import { fridgeTheme } from '@/v2/theme'

jest.mock('@/v2/api', () => ({
  ...(jest.requireActual('@/v2/api') as object),
  api: jest.fn(),
}))
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }))

const apiMock = api as unknown as Mock<(p: string, i?: { method?: string; body?: unknown; kid?: boolean }) => Promise<unknown>>

const ana = { id: 1, full_name: 'Ana', avatar: '🦊', has_pin: false }
const ben = { id: 2, full_name: 'Ben', avatar: '🐼', has_pin: true }
const whoami = (kids: object[], device: object | null = { id: 1, name: 'iPad' }) => ({ device, kids })
const today = (over: object = {}) => ({
  locked: true,
  points_balance: 12,
  chores: [
    { id: 7, title: 'Dishes', points: 5, state: 'todo' },
    { id: 8, title: 'Bed', points: 3, state: 'needs_you' },
    { id: 9, title: 'Trash', points: 2, state: 'done' },
  ],
  ...over,
})

type Routes = Record<string, () => unknown>
function route(r: Routes) {
  apiMock.mockImplementation(async (p, i) => {
    const h = r[`${i?.method ?? 'GET'} ${p}`]
    if (!h && p.endsWith('/seen')) return {}
    if (!h) throw new Error(`unrouted ${p}`)
    const v = h()
    if (v instanceof Error) throw v
    return v
  })
}
const calls = (p: string) => apiMock.mock.calls.filter((c) => c[0] === p)
const openDishes = async () => userEvent.click(await screen.findByRole('button', { name: 'Open Dishes' }))
const doneBtn = () => screen.getByRole('button', { name: /I'm done!/ })

function renderKid() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider theme={fridgeTheme}>
        <KidPage />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  apiMock.mockReset()
  ;(notifications.show as unknown as Mock<() => void>).mockReset()
  window.matchMedia =
    window.matchMedia ||
    ((() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never)
})

describe('kid lock screen', () => {
  test('unknown device shows message and never logs in', async () => {
    route({ 'GET /kid/whoami': () => whoami([], null) })
    renderKid()
    expect(await screen.findByText("This device isn't set up yet. Ask a parent to add it.")).toBeInTheDocument()
    expect(calls('/kid/login')).toHaveLength(0)
  })

  test('single kid without PIN logs in automatically', async () => {
    route({
      'GET /kid/whoami': () => whoami([ana]),
      'POST /kid/login': () => ({ access_token: 'tok' }),
      'GET /kid/today': () => today(),
    })
    renderKid()
    expect(await screen.findByText('Internet is paused')).toBeInTheDocument()
    expect(apiMock).toHaveBeenCalledWith('/kid/login', { method: 'POST', body: { kid_id: 1 }, kid: true })
    expect(localStorage.getItem(KID_TOKEN_KEY)).toBe('tok')
    expect(screen.getByRole('button', { name: 'Open Dishes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Bed' })).toBeInTheDocument()
  })

  test('two kids show the picker and never auto-pick', async () => {
    route({ 'GET /kid/whoami': () => whoami([ana, ben]) })
    renderKid()
    expect(await screen.findByRole('button', { name: /Ana/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ben/ })).toBeInTheDocument()
    expect(calls('/kid/login')).toHaveLength(0)
  })

  test('picking a kid with PIN shows the pad, no login yet', async () => {
    route({ 'GET /kid/whoami': () => whoami([ana, ben]) })
    renderKid()
    await userEvent.click(await screen.findByRole('button', { name: /Ben/ }))
    expect(await screen.findByRole('group', { name: 'PIN' })).toBeInTheDocument()
    expect(calls('/kid/login')).toHaveLength(0)
  })

  test('picking a kid without PIN logs in', async () => {
    route({
      'GET /kid/whoami': () => whoami([ana, ben]),
      'POST /kid/login': () => ({ access_token: 'tok' }),
      'GET /kid/today': () => today(),
    })
    renderKid()
    await userEvent.click(await screen.findByRole('button', { name: /Ana/ }))
    expect(await screen.findByText('Internet is paused')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'PIN' })).toBeNull()
  })

  test('wrong PIN and rate limit messages', async () => {
    let n = 0
    route({
      'GET /kid/whoami': () => whoami([ben]),
      'POST /kid/login': () => (n++ === 0 ? new ApiError(401, 'Wrong PIN. Try again.') : new ApiError(429, 'x')),
    })
    renderKid()
    for (const d of '1234') await userEvent.click(await screen.findByRole('button', { name: d }))
    expect(await screen.findByText('Wrong PIN. Try again.')).toBeInTheDocument()
    expect(apiMock).toHaveBeenCalledWith('/kid/login', { method: 'POST', body: { kid_id: 2, pin: '1234' }, kid: true })
    await userEvent.keyboard('5678')
    expect(await screen.findByText('Too many tries. Wait a minute and try again.')).toBeInTheDocument()
  })

  test('Mark done posts, refetches and toasts', async () => {
    localStorage.setItem(KID_TOKEN_KEY, 'tok')
    route({
      'GET /kid/whoami': () => whoami([ana]),
      'GET /kid/today': () => today(),
      'POST /kid/chores/7/done': () => ({ id: 7 }),
    })
    renderKid()
    await openDishes()
    await userEvent.click(doneBtn())
    await waitFor(() => expect(calls('/kid/today').length).toBeGreaterThan(1))
    expect(apiMock).toHaveBeenCalledWith('/kid/chores/7/done', { method: 'POST', kid: true })
    expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Marked done' }))
  })

  test('flips to unlocked when data changes', async () => {
    localStorage.setItem(KID_TOKEN_KEY, 'tok')
    let locked = true
    route({
      'GET /kid/whoami': () => whoami([ana]),
      'GET /kid/today': () => today({ locked }),
      'POST /kid/chores/7/done': () => ({ id: 7 }),
    })
    renderKid()
    expect(await screen.findByText('Internet is paused')).toBeInTheDocument()
    locked = false
    await openDishes()
    await userEvent.click(doneBtn())
    await userEvent.click(await screen.findByRole('button', { name: /All chores/ }))
    expect(await screen.findByText('Internet is on')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Dishes' })).toBeInTheDocument()
  })

  test('kid 401 clears the token and restarts at whoami', async () => {
    localStorage.setItem(KID_TOKEN_KEY, 'old')
    route({
      'GET /kid/whoami': () => whoami([ana, ben]),
      'GET /kid/today': () => new AuthError('Please log in again.', true),
    })
    renderKid()
    expect(await screen.findByRole('button', { name: /Ben/ })).toBeInTheDocument()
    expect(localStorage.getItem(KID_TOKEN_KEY)).toBeNull()
  })

  test('wrong PIN 401 stays on the kid auth path', async () => {
    route({
      'GET /kid/whoami': () => whoami([ben]),
      'POST /kid/login': () => new AuthError('Wrong PIN. Try again.', true),
    })
    renderKid()
    for (const d of '1234') await userEvent.click(await screen.findByRole('button', { name: d }))
    expect(await screen.findByText('Wrong PIN. Try again.')).toBeInTheDocument()
    expect(apiMock).toHaveBeenCalledWith('/kid/login', expect.objectContaining({ kid: true }))
  })

  test('today failure shows retry, not endless loading', async () => {
    localStorage.setItem(KID_TOKEN_KEY, 'tok')
    route({
      'GET /kid/whoami': () => whoami([ana]),
      'GET /kid/today': () => new ApiError(500, 'boom'),
    })
    renderKid()
    expect(await screen.findByText("Can't reach the home box. Check it's plugged in and on Wi-Fi.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  test('shows the solo kid name on a stored-token reload', async () => {
    localStorage.setItem(KID_TOKEN_KEY, 'tok')
    route({ 'GET /kid/whoami': () => whoami([ana]), 'GET /kid/today': () => today() })
    renderKid()
    expect(await screen.findByRole('heading', { name: 'Hi Ana!' })).toBeInTheDocument()
  })

  test('mark-done 401 restarts at whoami', async () => {
    localStorage.setItem(KID_TOKEN_KEY, 'tok')
    route({
      'GET /kid/whoami': () => whoami([ana, ben]),
      'GET /kid/today': () => today(),
      'POST /kid/chores/7/done': () => new AuthError('Please log in again.', true),
    })
    renderKid()
    await openDishes()
    await userEvent.click(doneBtn())
    expect(await screen.findByRole('button', { name: /Ben/ })).toBeInTheDocument()
    expect(localStorage.getItem(KID_TOKEN_KEY)).toBeNull()
  })

  test('refetches /kid/today every 10 s', async () => {
    localStorage.setItem(KID_TOKEN_KEY, 'tok')
    route({ 'GET /kid/whoami': () => whoami([ana]), 'GET /kid/today': () => today() })
    jest.useFakeTimers({ advanceTimers: true })
    try {
      renderKid()
      await screen.findByText('Internet is paused')
      const n = calls('/kid/today').length
      await act(async () => {
        jest.advanceTimersByTime(10_500)
      })
      await waitFor(() => expect(calls('/kid/today').length).toBeGreaterThan(n))
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('kid chore extras', () => {
  const sub = (done: boolean) => [
    { id: 11, title: 'Wipe table', done },
    { id: 12, title: 'Sweep floor', done },
  ]
  const withChores = (chores: object[]) => {
    localStorage.setItem(KID_TOKEN_KEY, 'tok')
    route({
      'GET /kid/whoami': () => whoami([ana]),
      'GET /kid/today': () => today({ chores }),
      'POST /kid/chores/7/subtasks/11': () => ({}),
      'POST /kid/chores/7/photos': () => ({ id: 1, attempt: 1 }),
    })
  }
  const base = { id: 7, title: 'Dishes', points: 5, state: 'todo' }

  test('Mark done is disabled until every step is ticked', async () => {
    withChores([{ ...base, subtasks: sub(false) }])
    renderKid()
    await openDishes()
    expect(doneBtn()).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Wipe table' }))
    expect(apiMock).toHaveBeenCalledWith('/kid/chores/7/subtasks/11', { method: 'POST', body: { done: true }, kid: true })
  })

  test('Mark done is enabled once all steps are ticked', async () => {
    withChores([{ ...base, subtasks: sub(true) }])
    renderKid()
    await openDishes()
    expect(doneBtn()).toBeEnabled()
  })

  test('needs-photo chore keeps Mark done disabled until a photo exists', async () => {
    withChores([{ ...base, needs_photo: true, photo_count_current: 0 }])
    renderKid()
    await openDishes()
    expect(doneBtn()).toBeDisabled()
  })

  test('photo with a current-attempt upload enables Mark done', async () => {
    withChores([{ ...base, needs_photo: true, photo_count_current: 2 }])
    renderKid()
    await openDishes()
    expect(doneBtn()).toBeEnabled()
    expect(screen.getByText('2 photos added')).toBeInTheDocument()
  })

  test('upload posts FormData with file', async () => {
    withChores([{ ...base, needs_photo: true, photo_count_current: 0 }])
    renderKid()
    await openDishes()
    const input = (await screen.findByLabelText('Add photo')) as HTMLInputElement
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' })
    await userEvent.upload(input, file)
    await waitFor(() => expect(calls('/kid/chores/7/photos')).toHaveLength(1))
    const init = calls('/kid/chores/7/photos')[0][1] as { body: FormData; method: string; kid: boolean }
    expect(init.method).toBe('POST')
    expect(init.kid).toBe(true)
    expect(init.body.get('file')).toBe(file)
  })

  test('sent-back chore shows the parent note', async () => {
    withChores([{ ...base, last_note: 'Do the pans too' }])
    renderKid()
    await openDishes()
    expect(await screen.findByText('Sent back: Do the pans too')).toBeInTheDocument()
  })

  test('race taken by a sibling shows who and no Done button', async () => {
    withChores([{ ...base, state: 'needs_you', mode: 'race', taken_by: 'Maya' }])
    renderKid()
    await openDishes()
    expect(await screen.findByText('Taken by Maya')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /I'm done!/ })).toBeNull()
  })
})
