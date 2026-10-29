import type { ReactNode } from 'react'

// `@` + a word (any-script letters, digits, _), like the server's Python `@(\w+)`; built with
// RegExp() because the TS target (es5) rejects the `u` flag in a literal
const WORD = '[\\p{L}\\p{N}_]'

/** Message text with each `@Name` of a thread member (case-insensitive) as a bold text node. */
export function renderMentions(body: string, names: string[]): ReactNode[] {
  const known = new Set(names.map((n) => n.toLowerCase()))
  const out: ReactNode[] = []
  let at = 0
  const token = new RegExp(`@(${WORD}+)`, 'gu')
  for (let m = token.exec(body); m; m = token.exec(body)) {
    if (!known.has(m[1].toLowerCase())) continue
    const i = m.index
    if (i > at) out.push(body.slice(at, i))
    out.push(
      <b key={i} className="pc-mention">
        {m[0]}
      </b>,
    )
    at = i + m[0].length
  }
  if (at < body.length) out.push(body.slice(at))
  return out
}

/** The `@word` being typed just before the caret (at the start or after a space), else null. */
export function mentionAt(text: string, caret: number): { start: number; q: string } | null {
  const m = new RegExp(`(^|\\s)@(${WORD}*)$`, 'u').exec(text.slice(0, caret))
  return m ? { start: caret - m[2].length - 1, q: m[2] } : null
}
