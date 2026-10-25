import { render, screen, fireEvent } from '@testing-library/react'
import { ThreadList } from '@/v2/chat/ThreadList'
import type { ThreadSummary } from '@/v2/hooks/useChat'

describe('ThreadList', () => {
  const mockThreads: ThreadSummary[] = [
    {
      id: 1,
      kind: 'chore',
      task_id: 10,
      kid_id: null,
      title: 'Buy groceries',
      last_message_at: '2026-10-24T10:00:00Z',
      last_text: 'Milk needed',
      last_author: 'Mom',
      unread: 0,
    },
    {
      id: 2,
      kind: 'family',
      task_id: null,
      kid_id: null,
      title: 'Family photo',
      last_message_at: '2026-10-24T09:00:00Z',
      last_text: 'Check this out',
      last_author: 'Dad',
      unread: 2,
    },
    {
      id: 3,
      kind: 'chore',
      task_id: 11,
      kid_id: null,
      title: 'Clean room',
      last_message_at: '2026-10-24T08:00:00Z',
      last_text: 'Please tidy up',
      last_author: 'Mom',
      unread: 1,
    },
    {
      id: 4,
      kind: 'chore',
      task_id: 12,
      kid_id: null,
      title: 'Homework',
      last_message_at: '2026-10-24T07:00:00Z',
      last_text: 'Need help',
      last_author: 'Leo',
      unread: 0,
    },
  ]

  it('renders tabs: All, Chores, Family (no Notes until the backend has notes)', () => {
    render(
      <ThreadList
        threads={mockThreads}
        selected={null}
        onPick={() => {}}
      />
    )

    expect(screen.getByText(/^All$/)).toBeInTheDocument()
    expect(screen.getByText(/^Chores/)).toBeInTheDocument()
    expect(screen.queryByText(/^Notes/)).toBeNull()
    expect(screen.getByText(/^Family$/)).toBeInTheDocument()
  })

  it('shows correct chore count in tab label', () => {
    render(
      <ThreadList
        threads={mockThreads}
        selected={null}
        onPick={() => {}}
      />
    )

    expect(screen.getByText('Chores · 3')).toBeInTheDocument()
  })

  it('filters threads by chores tab', () => {
    render(
      <ThreadList
        threads={mockThreads}
        selected={null}
        onPick={() => {}}
      />
    )

    const buttons = screen.getAllByRole('button')
    const choresTab = buttons.find(btn => btn.textContent?.startsWith('Chores'))
    if (choresTab) {
      fireEvent.click(choresTab)
    }

    expect(screen.getByText('Buy groceries')).toBeInTheDocument()
    expect(screen.getByText('Clean room')).toBeInTheDocument()
    expect(screen.queryByText('Family photo')).not.toBeInTheDocument()
  })

  it('filters threads by family tab', () => {
    render(
      <ThreadList
        threads={mockThreads}
        selected={null}
        onPick={() => {}}
      />
    )

    const buttons = screen.getAllByRole('button')
    const familyTab = buttons.find(btn => btn.textContent === 'Family')
    if (familyTab) {
      fireEvent.click(familyTab)
    }

    expect(screen.getByText('Family photo')).toBeInTheDocument()
    expect(screen.queryByText('Buy groceries')).not.toBeInTheDocument()
    expect(screen.queryByText('Clean room')).not.toBeInTheDocument()
  })

  it('searches threads by title and text', () => {
    render(
      <ThreadList
        threads={mockThreads}
        selected={null}
        onPick={() => {}}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search chats') as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: 'milk' } })

    expect(screen.getByText('Buy groceries')).toBeInTheDocument()
    expect(screen.queryByText('Family photo')).not.toBeInTheDocument()
    expect(screen.queryByText('Clean room')).not.toBeInTheDocument()
  })

  it('no search match shows a clear-search state', async () => {
    render(<ThreadList threads={mockThreads} selected={null} onPick={() => {}} />)
    fireEvent.change(screen.getByLabelText('Search threads'), { target: { value: 'piano' } })
    expect(screen.getByText('No chats match “piano”')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /clear search/i }))
    expect(screen.queryByText(/No chats match/)).toBeNull()
  })

  it('calls onPick when thread is selected', () => {
    const mockOnPick = jest.fn()
    render(
      <ThreadList
        threads={mockThreads}
        selected={null}
        onPick={mockOnPick}
      />
    )

    const threadButton = screen.getByText('Buy groceries').closest('button')
    if (threadButton) {
      fireEvent.click(threadButton)
    }

    expect(mockOnPick).toHaveBeenCalledWith(mockThreads[0])
  })


  it('displays unread badge for unread messages', () => {
    render(
      <ThreadList
        threads={mockThreads}
        selected={null}
        onPick={() => {}}
      />
    )

    expect(screen.getByTestId('unread-2')).toHaveTextContent('2')
    expect(screen.getByTestId('unread-3')).toHaveTextContent('1')
  })

  it('shows the unread count in a badge and "You:" on own last lines', () => {
    render(<ThreadList threads={mockThreads} selected={null} onPick={() => {}} meName="Dad" />)

    const unreadBadge = screen.getByTestId('unread-2')
    expect(unreadBadge).toHaveClass('pc-badge')
    expect(unreadBadge).toHaveTextContent('2')
    expect(screen.getByText('You: Check this out')).toBeInTheDocument()
    expect(screen.getByText('Mom: Milk needed')).toBeInTheDocument()
  })

  it('marks the selected row', () => {
    render(<ThreadList threads={mockThreads} selected="family:family" onPick={() => {}} />)
    expect(screen.getByRole('button', { name: /Family photo/ })).toHaveAttribute('aria-current', 'true')
  })
})
