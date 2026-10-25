import { useEffect, useRef, useState } from 'react'
import { Popover, TextInput } from '@mantine/core'
import { Icon } from '@/v2/parent/Icon'
import { useReact, type ChatMessage } from '@/v2/hooks/useChat'
import { toastFail } from '@/v2/notify'
import { EMOJI_GROUPS, searchEmoji, type Emoji } from './emojiData'

export const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const DELAY = 150 // hover intent: room to move the mouse from a button into what it opened

/**
 * Reaction button for the hover toolbar. Hover (or click) shows the Teams-style quick row;
 * hover (or click) its "more" button for the searchable picker. `onOpen` tells the toolbar
 * to stay visible while either is open.
 */
export function ReactBar({ m, kid, onOpen }: { m: ChatMessage; kid: boolean; onOpen: (open: boolean) => void }) {
  const react = useReact(kid)
  const [open, setOpenState] = useState(false)
  const [picker, setPicker] = useState(false)
  const [q, setQ] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const cancel = () => clearTimeout(timer.current)
  const later = (fn: () => void) => {
    cancel()
    timer.current = setTimeout(fn, DELAY)
  }
  const setOpen = (o: boolean) => {
    setOpenState(o)
    onOpen(o)
  }
  const close = () => {
    cancel()
    setPicker(false)
    setQ('')
    setOpen(false)
  }
  const pick = (emoji: string) => {
    react.mutate({ id: m.id, emoji }, { onError: toastFail })
    close()
  }
  const cell = (e: Emoji) => (
    <button key={e.char} type="button" className="msg-pick-cell" aria-label={e.name} title={e.name} onClick={() => pick(e.char)}>
      {e.char}
    </button>
  )
  const found = q.trim() ? searchEmoji(q) : null

  return (
    <span
      className="msg-react-bar"
      onMouseEnter={cancel}
      onMouseLeave={() => !picker && later(close)}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !open) return
        e.stopPropagation() // the chat dock closes on Escape too
        close()
      }}
      onBlur={(e) => {
        if (!picker && !e.currentTarget.contains(e.relatedTarget)) close()
      }}
    >
      {open && (
        <span className="msg-quick" role="group" aria-label="Quick reactions">
          {QUICK.map((e) => (
            <button key={e} type="button" className="msg-act-btn msg-emoji" aria-label={`React ${e}`} title={`React ${e}`} onClick={() => pick(e)}>
              {e}
            </button>
          ))}
          <Popover
            opened={picker}
            onChange={(o) => (o ? setPicker(true) : close())}
            position="bottom-end"
            zIndex={400}
            withinPortal
            trapFocus
            shadow="md"
          >
            <Popover.Target>
              <button
                type="button"
                className="msg-act-btn"
                aria-label="More reactions"
                title="More reactions"
                aria-expanded={picker}
                onMouseEnter={() => later(() => setPicker(true))}
                onClick={() => (cancel(), setPicker(true))}
              >
                <Icon name="add" size={18} />
              </button>
            </Popover.Target>
            <Popover.Dropdown className="msg-picker" onMouseEnter={cancel}>
              <TextInput
                data-autofocus
                size="xs"
                aria-label="Search emoji"
                placeholder="Search emoji"
                value={q}
                onChange={(ev) => setQ(ev.currentTarget.value)}
              />
              <div className="msg-pick-scroll">
                {found ? (
                  found.length ? (
                    <div className="msg-pick-grid">{found.map(cell)}</div>
                  ) : (
                    <p className="msg-pick-none">No emoji found</p>
                  )
                ) : (
                  EMOJI_GROUPS.map((g) => (
                    <div key={g.category}>
                      <div className="msg-pick-cat">{g.category}</div>
                      <div className="msg-pick-grid">{g.emoji.map(cell)}</div>
                    </div>
                  ))
                )}
              </div>
            </Popover.Dropdown>
          </Popover>
        </span>
      )}
      <button
        type="button"
        className="msg-act-btn"
        aria-label="Add reaction"
        title="React"
        aria-expanded={open}
        onMouseEnter={() => later(() => setOpen(true))}
        onClick={() => (cancel(), setOpen(true))}
      >
        <Icon name="add_reaction" size={16} />
      </button>
    </span>
  )
}

/** Chips under a bubble: "👍 2", pressed when I reacted; click toggles mine. */
export function ReactionChips({ m, kid, mine }: { m: ChatMessage; kid: boolean; mine: boolean }) {
  const react = useReact(kid)
  if (!m.reactions?.length) return null
  return (
    <div className="msg-reacts" data-mine={mine}>
      {m.reactions.map((r) => {
        const who = r.names.join(', ')
        return (
          <button
            key={r.emoji}
            type="button"
            className="msg-react"
            aria-pressed={r.mine}
            aria-label={`${r.emoji} ${r.count}: ${who}`}
            title={who}
            onClick={() => react.mutate({ id: m.id, emoji: r.emoji }, { onError: toastFail })}
          >
            {r.emoji} <span>{r.count}</span>
          </button>
        )
      })}
    </div>
  )
}
