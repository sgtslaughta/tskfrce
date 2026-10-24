import { useState } from 'react'
import type { TodayChore } from '../types'
import { Chip } from '../parent/Chip'
import { Icon } from '../parent/Icon'

const stateChip = (state: string) => {
  if (state === 'done') return <Chip tone="acc" icon="check">Approved</Chip>
  if (state === 'needs_you') return <Chip tone="lav" icon="hourglass_top">Needs OK</Chip>
  if (state === 'todo') return <Chip tone="grey" icon="radio_button_unchecked">To do</Chip>
  return null
}

const formatTime = (state: string, done_at?: string | null) => {
  if (state !== 'done') return null
  if (!done_at) {
    const now = new Date()
    return `Done ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  }
  return `Done ${new Date(done_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

export function ChoreRow({
  chore,
  isOpen,
  onToggle,
}: {
  chore: TodayChore
  isOpen: boolean
  onToggle: () => void
}) {
  const isDone = chore.state === 'done'

  return (
    <div data-testid="chore-row" data-open={isOpen} className="p-chore-row">
      <button
        className="p-chore-header"
        onClick={onToggle}
        style={isDone ? { textDecoration: 'line-through' } : {}}
      >
        <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={20} />
        <input
          type="checkbox"
          checked={isDone}
          onChange={(e) => e.stopPropagation()}
          className="p-chore-checkbox"
        />
        <span className="p-chore-title">{chore.title}</span>
        {isDone && chore.done_at && (
          <span style={{ fontSize: '0.9em', color: '#666' }}>
            {formatTime(chore.state, chore.done_at)}
          </span>
        )}
        <span className="p-chore-chip">{stateChip(chore.state)}</span>
        <span className="p-chore-points">{chore.points} pts</span>
      </button>
    </div>
  )
}
