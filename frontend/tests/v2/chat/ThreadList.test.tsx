import { render, screen, fireEvent } from '@testing-library/react'
import { ThreadList } from '@/v2/chat/ThreadList'
import type { ThreadSummary } from '@/v2/hooks/useChat'

describe('ThreadList', () => {
  const mockThreads: ThreadSummary[] = [
    {
      id: '1',
      kind: 'chore',
      title: 'Buy groceries',
      last_message_at: '2026-10-24T10:00:00Z',
      last_text: 'Milk needed',
      last_author: 'Mom',
      unread: 0,
    },
    {
      id: '2',
      kind: 'family',
      title: 'Family photo',
      last_message_at: '2026-10-24T09:00:00Z',
      last_text: 'Check this out',
      last_author: 'Dad',
      unread: 2,
    },
    {
      id: '3',
      kind: 'chore',
      title: 'Clean room',
      last_message_at: '2026-10-24T08:00:00Z',
      last_text: 'Please tidy up',
      last_author: 'Mom',
      unread: 1,
    },
  ]

  it('renders tabs: All, Chores, Notes, Family', () => {
    render(
      <ThreadList
        threads={mockThreads}
        selected={null}
        onPick={() => {}}
      />
    )

    expect(screen.getByText(/^All$/)).toBeInTheDocument()
    expect(screen.getByText(/^Chores/)).toBeInTheDocument()
    expect(screen.getByText(/^Notes/)).toBeInTheDocument()
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

    expect(screen.getByText('Chores · 2')).toBeInTheDocument()
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

  it('unread badge has correct accent styling (--p-acc background with #292928 text)', () => {
    render(
      <ThreadList
        threads={mockThreads}
        selected={null}
        onPick={() => {}}
      />
    )

    const unreadBadge = screen.getByTestId('unread-2')
    expect(unreadBadge).toHaveStyle({
      background: 'var(--p-acc)',
      color: '#292928',
    })
  })
})
