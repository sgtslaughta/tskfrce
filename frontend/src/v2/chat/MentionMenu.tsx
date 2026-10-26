import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type SyntheticEvent } from 'react'
import { useTypingPing } from '@/v2/hooks/useChat'
import { mentionAt } from './mentions'

type Member = { id: number; name: string }

/** Composer text box wiring shared by the parent and kid composers: typing pings, the `@` menu
 * (button or typed), Enter to send, and `fill` to replace the text with the caret at the end. */
export function useComposerBox({
  text,
  setText,
  send,
  members = [],
  meId,
  threadId,
  kid,
}: {
  text: string
  setText: (s: string) => void
  send: () => void
  members?: Member[]
  meId: number | null
  threadId: number | null
  kid: boolean
}) {
  const box = useRef<HTMLTextAreaElement>(null)
  const ping = useTypingPing(threadId, kid)
  const [at, setAt] = useState<{ start: number; q: string } | null>(null)
  const [hi, setHi] = useState(0)
  const [caret, setCaret] = useState<{ pos: number } | null>(null)
  const list = at ? members.filter((m) => m.id !== meId && m.name.toLowerCase().startsWith(at.q.toLowerCase())) : []

  // after a programmatic change, focus the box and put the caret where asked
  useEffect(() => {
    const el = box.current
    if (!caret || !el) return
    el.focus()
    el.setSelectionRange(caret.pos, caret.pos)
  }, [caret])

  const put = (value: string, pos: number) => {
    setText(value)
    setCaret({ pos })
  }
  const open = (next: { start: number; q: string } | null) => {
    setAt(next)
    setHi(0)
  }
  const pick = (name: string) => {
    if (!at) return
    const ins = `@${name} `
    put(text.slice(0, at.start) + ins + text.slice(at.start + 1 + at.q.length), at.start + ins.length)
    open(null)
  }

  return {
    box,
    menu: { list, hi, pick },
    /** the `@` button: insert `@` at the caret and open the menu */
    mention: () => {
      const el = box.current
      const s = el?.selectionStart ?? text.length
      const e = el?.selectionEnd ?? s
      const ins = s > 0 && !/\s/.test(text[s - 1]) ? ' @' : '@'
      put(text.slice(0, s) + ins + text.slice(e), s + ins.length)
      open({ start: s + ins.length - 1, q: '' })
    },
    /** quick reply: replace the draft, caret at the end */
    fill: (value: string) => {
      put(value, value.length)
      open(null)
    },
    onChange: (e: ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value
      setText(v)
      if (v.trim()) ping()
      open(mentionAt(v, e.target.selectionStart ?? v.length))
    },
    /** caret moved (click, arrow keys): follow it, so a stale menu can't eat Enter */
    onSelect: (e: SyntheticEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget
      const n = mentionAt(el.value, el.selectionStart ?? el.value.length)
      if (!n || !at || n.start !== at.start || n.q !== at.q) open(n)
    },
    onBlur: () => open(null),
    onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (at && e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation() // keep the dock open
        open(null)
      } else if (list.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault()
        setHi((hi + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length)
      } else if (list.length && (e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
        e.preventDefault()
        pick(list[Math.min(hi, list.length - 1)].name)
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        send()
      }
    },
  }
}

/** Thread members matching the `@word` being typed; solid popover card above the composer. */
export function MentionMenu({ list, hi, pick }: { list: Member[]; hi: number; pick: (name: string) => void }) {
  if (!list.length) return null
  return (
    <ul className="pc-mentions" role="listbox" aria-label="Mention">
      {list.map((m, i) => (
        <li
          key={m.id}
          role="option"
          aria-selected={i === hi}
          onMouseDown={(e) => e.preventDefault()} // keep focus in the text box
          onClick={() => pick(m.name)}
        >
          <span className="pc-mentions-av" aria-hidden="true">
            {(m.name[0] ?? '?').toUpperCase()}
          </span>
          {m.name}
        </li>
      ))}
    </ul>
  )
}
