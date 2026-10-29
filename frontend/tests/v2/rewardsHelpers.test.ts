import { describe, expect, test } from '@jest/globals'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { useApproveAll, useDecideRedemption, useSaveReward } from '@/v2/hooks/useRewards'
import { api } from '@/v2/api'
import { useTypingPing } from '@/v2/hooks/useChat'
import { BADGE_GLYPH, badgeGlyph } from '@/v2/badgeGlyphs'
import { REWARD_GLYPHS } from '@/v2/parent/glyphs'
import { downloadCsv, toCsv } from '@/v2/manage/historyCsv'
import type { HistoryRow } from '@/v2/types'

jest.mock('@/v2/api', () => ({ api: jest.fn() }))

const CATALOG = ['first_blood', 'task_master', 'workhorse', 'on_fire', 'comeback_kid', 'weekend_warrior', 'variety_pack', 'early_bird', 'speedrunner', 'clutch', 'never_late', 'stacking', 'saver', 'big_spender', 'goal_getter', 'patience_pays', 'time_lord', 'drip']
const MIGRATION_TARGETS = ['movie', 'icecream', 'bedtime', 'local_pizza', 'restaurant', 'sports_esports', 'park', 'cake', 'toys', 'timer', 'payments', 'menu_book', 'redeem', 'shopping_bag', 'sports_soccer', 'palette', 'music_note', 'pool', 'pedal_bike', 'cookie', 'celebration', 'star']

const row = (o: Partial<HistoryRow>): HistoryRow => ({
  id: 1, kid_id: 1, kid_name: 'Leo', kind: 'reward', name: 'Movie', minutes: null, cost: 50, status: 'approved',
  auto: false, decided_by_name: 'Mom', note: null, created_at: '2026-10-20T10:00:00Z', decided_at: '2026-10-20T11:00:00Z', ...o,
})

describe('badgeGlyph', () => {
  test('built-in, unknown and custom', () => {
    expect(badgeGlyph({ key: 'on_fire', custom: false, icon: '🔥' })).toBe('whatshot')
    expect(badgeGlyph({ key: 'nope', custom: false, icon: '' })).toBe('military_tech')
    expect(badgeGlyph({ key: 'custom:1', custom: true, icon: 'pets' })).toBe('pets')
    expect(badgeGlyph({ key: 'custom:1', custom: true, icon: '' })).toBe('military_tech')
  })
  test('every catalog key has an entry', () => {
    for (const k of CATALOG) expect(BADGE_GLYPH[k]).toBeTruthy()
  })
})

test('REWARD_GLYPHS covers migration targets', () => {
  for (const g of MIGRATION_TARGETS) expect(REWARD_GLYPHS).toContain(g)
})

describe('toCsv', () => {
  test('header and status mapping', () => {
    const lines = toCsv([row({}), row({ status: 'denied' }), row({ auto: true })]).split('\n')
    expect(lines[0]).toBe('date,kid,item,kind,status,points,decided_by,note')
    expect(lines[1]).toContain(',approved,50,Mom,')
    expect(lines[2]).toContain(',declined,')
    expect(lines[3]).toContain(',auto,')
  })
  test('quotes commas and doubles quotes', () => {
    const csv = toCsv([row({ note: "let's talk, Sat" }), row({ note: 'say "hi"' })])
    expect(csv).toContain('"let\'s talk, Sat"')
    expect(csv).toContain('"say ""hi"""')
  })
})

describe('toCsv formula safety', () => {
  test('neutralises leading formula chars in text, keeps numbers', () => {
    const csv = toCsv([row({ note: '=1+1', name: '-cmd', cost: -200 })])
    expect(csv).toContain("'=1+1")
    expect(csv).toContain("'-cmd")
    expect(csv).toContain(',-200,')
  })
})

describe('useTypingPing', () => {
  test('throttles to one POST per 3 s and resets on thread change', () => {
    jest.useFakeTimers()
    const post = api as unknown as jest.Mock
    post.mockClear(); post.mockResolvedValue(null)
    const { result, rerender } = renderHook(({ id }) => useTypingPing(id), { initialProps: { id: 1 } })
    result.current(); result.current(); result.current()
    expect(post).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(3100)
    result.current()
    expect(post).toHaveBeenCalledTimes(2)
    rerender({ id: 2 })
    result.current()
    expect(post).toHaveBeenCalledTimes(3)
    jest.useRealTimers()
  })
})

describe('csv date and BOM', () => {
  test('date column prefers decided_at, falls back to created_at', () => {
    const lines = toCsv([row({}), row({ decided_at: null })]).split('\n')
    expect(lines[1].startsWith('2026-10-20T11:00:00Z,')).toBe(true)
    expect(lines[2].startsWith('2026-10-20T10:00:00Z,')).toBe(true)
  })
  test('downloadCsv prepends a UTF-8 BOM', async () => {
    let blob: Blob | undefined
    URL.createObjectURL = jest.fn((b: Blob) => ((blob = b), 'blob:x'))
    URL.revokeObjectURL = jest.fn()
    downloadCsv('a.csv', 'date,kid\nx,Zoë')
    const bytes = await new Promise<Uint8Array>((res) => {
      const fr = new FileReader()
      fr.onload = () => res(new Uint8Array(fr.result as ArrayBuffer))
      fr.readAsArrayBuffer(blob as Blob)
    })
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
  })
})

describe('reward mutations invalidate on settle', () => {
  const run = async (hook: () => { mutate: (v: never) => void }, v: unknown) => {
    const qc = new QueryClient()
    const inv = jest.spyOn(qc, 'invalidateQueries')
    ;(api as unknown as jest.Mock).mockRejectedValue(new Error('boom'))
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children)
    const { result } = renderHook(hook, { wrapper })
    result.current.mutate(v as never)
    await waitFor(() => expect(inv).toHaveBeenCalled())
    return inv.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0])
  }
  test('approve all and decide refresh even on error, incl. screen-time', async () => {
    expect(await run(useApproveAll, undefined)).toEqual(expect.arrayContaining(['redemptions', 'screen-time']))
    expect(await run(useDecideRedemption, { id: 1, approve: false })).toEqual(expect.arrayContaining(['screen-time']))
  })
  test('save reward refreshes redemptions', async () => {
    expect(await run(useSaveReward, { body: { name: 'a', price: 1 } })).toEqual(expect.arrayContaining(['rewards', 'redemptions']))
  })
})
