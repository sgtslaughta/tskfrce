import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Popover, TextInput } from '@mantine/core'
import { Icon } from '@/v2/parent/Icon'
import { useReact, type ChatMessage } from '@/v2/hooks/useChat'
import { toastFail } from '@/v2/notify'
import { EMOJI_GROUPS, searchEmoji, type Emoji } from './emojiData'

export const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const DELAY = 150 // hover intent: room to move the mouse from a button into what it opened

/**
 * Reaction button for the hover toolbar. Hover (or click) shows the Teams-style quick row just
 * below it, overlaying the bubble so Edit/Delete never move; hover (or click) its "+" for the
 * searchable picker. `onOpen` tells the toolbar to stay visible while either is open.
 */
export function ReactBar({ m, kid, onOpen }: { m: ChatMessage; kid: boolean; onOpen: (open: boolean) => void }) {
  const react = useReact(kid)
  const [open, setOpenState] = useState(false)
  const [picker, setPicker] = useState(false)
  const [grab, setGrab] = useState(false) // opened by click/keyboard: focus the search box
  const [shift, setShift] = useState(0)
  const [q, setQ] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const overBar = useRef(false)
  const btn = useRef<HTMLButtonElement>(null)
  const row = useRef<HTMLSpanElement>(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  // the row grows leftwards over the bubble; nudge it right if that would leave the chat column
  useLayoutEffect(() => {
    if (!open || !row.current) return setShift(0)
    const col = row.current.closest('[data-chat-scroll]')?.getBoundingClientRect()
    const box = row.current.getBoundingClientRect()
    const left = (col?.left ?? 0) + 4
    if (box.left < left) setShift(Math.min(left - box.left, (col?.right ?? innerWidth) - 4 - box.right))
  }, [open])
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
  const openPicker = (focus: boolean) => {
    cancel()
    setGrab(focus)
    setPicker(true)
  }
  const pick = (emoji: string, e: React.MouseEvent) => {
    react.mutate({ id: m.id, emoji }, { onError: toastFail })
    close()
    if (e.detail === 0) btn.current?.focus() // keyboard pick: back to the React button
  }
  const cell = (e: Emoji) => (
    <button key={e.char} type="button" className="msg-pick-cell" aria-label={e.name} title={e.name} onClick={(ev) => pick(e.char, ev)}>
      {e.char}
    </button>
  )
  const found = q.trim() ? searchEmoji(q) : null

  return (
    <span
      className="msg-react-bar"
      onMouseEnter={() => {
        overBar.current = true
        cancel()
      }}
      onMouseLeave={() => {
        overBar.current = false
        if (!picker) later(close)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !open) return
        e.stopPropagation() // the chat dock closes on Escape too
        close()
        btn.current?.focus()
      }}
      onBlur={(e) => {
        if (!picker && !e.currentTarget.contains(e.relatedTarget)) close()
      }}
    >
      <button
        ref={btn}
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
      {open && (
        <span
          ref={row}
          className="msg-quick"
          style={shift ? { transform: `translateX(${shift}px)` } : undefined}
          role="group"
          aria-label="Quick reactions"
        >
          {QUICK.map((e) => (
            <button key={e} type="button" className="msg-act-btn msg-emoji" aria-label={`React ${e}`} title={`React ${e}`} onClick={(ev) => pick(e, ev)}>
              {e}
            </button>
          ))}
          <Popover
            opened={picker}
            // closing the picker (e.g. a click on a quick emoji) leaves the quick row open,
            // unless the pointer has left the bar: then the row and toolbar go too
            onChange={(o) => {
              if (o) return setPicker(true)
              setPicker(false)
              setQ('')
              if (!overBar.current) later(close)
            }}
            position="bottom-end"
            zIndex={400}
            withinPortal
            trapFocus={grab}
            shadow="md"
          >
            <Popover.Target>
              <button
                type="button"
                className="msg-act-btn"
                aria-label="More reactions"
                title="More reactions"
                aria-expanded={picker}
                onMouseEnter={() => later(() => openPicker(false))}
                // passing over "+" on the way to a quick emoji must not open the picker
                onMouseLeave={() => !picker && cancel()}
                onClick={() => openPicker(true)}
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
            disabled={react.isPending && react.variables?.emoji === r.emoji}
            onClick={() => react.mutate({ id: m.id, emoji: r.emoji }, { onError: toastFail })}
          >
            {r.emoji} <span>{r.count}</span>
          </button>
        )
      })}
    </div>
  )
}
