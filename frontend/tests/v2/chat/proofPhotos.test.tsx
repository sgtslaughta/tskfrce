import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { groupProofPhotos } from '@/v2/chat/groupPhotos'
import { ParentBubble } from '@/v2/chat/ParentBubble'
import { ThreadList } from '@/v2/chat/ThreadList'
import type { ChatMessage } from '@/v2/hooks/useChat'

const sys = (id: number, at: string, o: Partial<ChatMessage> = {}): ChatMessage =>
  ({ id, kind: 'system', author_id: null, author_name: null, body: 'Photo added', photo_url: `/p/${id}`, created_at: at, ...o }) as ChatMessage

jest.mock('@/v2/chat/ChatPhoto', () => ({ Photo: () => <i /> }))

const wrap = (ui: React.ReactElement) =>
  render(
    <MantineProvider env="test">
      <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
    </MantineProvider>,
  )

describe('groupProofPhotos', () => {
  it('folds photos from one submission, splits on time, author or a user message', () => {
    const a = sys(1, '2026-10-27T10:00:00Z')
    const b = sys(2, '2026-10-27T10:00:05Z')
    const late = sys(3, '2026-10-27T10:05:00Z')
    const user = { ...sys(4, '2026-10-27T10:05:10Z'), kind: 'user' } as ChatMessage
    const g = groupProofPhotos([a, b, late, user])
    expect(g.map((x) => [x.m.id, x.more.map((y) => y.id)])).toEqual([[1, [2]], [3, []], [4, []]])
    expect(groupProofPhotos([a, sys(5, '2026-10-27T10:00:09Z', { author_id: 9 })])).toHaveLength(2)
  })

  it('keeps two kids photos within 2 minutes apart', () => {
    const x = sys(1, '2026-10-27T10:00:00Z', { author_id: 7, author_name: 'Leo' })
    const y = sys(2, '2026-10-27T10:00:30Z', { author_id: 8, author_name: 'Maya' })
    const z = sys(3, '2026-10-27T10:00:40Z', { author_id: 8, author_name: 'Maya' })
    expect(groupProofPhotos([x, y, z]).map((g) => [g.m.id, g.more.map((o) => o.id)])).toEqual([[1, []], [2, [3]]])
  })
})

describe('proof photo bubble', () => {
  it('is mine for a kid, other for a parent, with every photo in one bubble', () => {
    const a = sys(1, '2026-10-27T10:00:00Z')
    const b = sys(2, '2026-10-27T10:00:05Z')
    const { unmount } = wrap(<ParentBubble m={a} more={[b]} mine kid kidName="You" />)
    expect(screen.getAllByTestId('msg-mine')).toHaveLength(1)
    expect(screen.getAllByTestId('msg-system')).toHaveLength(1)
    expect(document.querySelectorAll('.pc-pics > *')).toHaveLength(2)
    unmount()
    wrap(<ParentBubble m={a} more={[b]} mine={false} kidName="Susan" />)
    expect(screen.getAllByTestId('msg-other')).toHaveLength(1)
    expect(screen.getByTestId('msg-system').textContent).toContain('2 photos added')
  })

  it('a sibling photo is labelled with its author, not You', () => {
    const a = sys(1, '2026-10-27T10:00:00Z', { author_id: 8, author_name: 'Maya' })
    wrap(<ParentBubble m={a} mine={false} kid kidName="You" />)
    expect(screen.getByTestId('msg-other').textContent).toContain('Maya')
    expect(screen.queryByText(/^You/)).toBeNull()
  })
})

describe('ThreadList tab counts', () => {
  it('hides the counts until the threads have loaded', () => {
    wrap(<ThreadList threads={[]} selected={null} onPick={() => {}} loaded={false} />)
    expect(screen.getByText('Chores')).toBeTruthy()
    expect(screen.queryByText(/·\s*0/)).toBeNull()
  })
})
