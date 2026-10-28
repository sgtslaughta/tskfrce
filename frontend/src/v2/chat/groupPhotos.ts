import type { ChatMessage } from '@/v2/hooks/useChat'

const WINDOW_MS = 2 * 60_000

/** Fold proof-photo system lines from one submission (same author, within 2 min of the first) into the first; the rest ride in `more`. */
export function groupProofPhotos(messages: ChatMessage[]): Array<{ m: ChatMessage; more: ChatMessage[] }> {
  const out: Array<{ m: ChatMessage; more: ChatMessage[] }> = []
  for (const m of messages) {
    const g = out[out.length - 1]
    const proof = (x: ChatMessage) => x.kind === 'system' && !!x.photo_url
    if (g && proof(m) && proof(g.m) && m.author_id === g.m.author_id && Date.parse(m.created_at) - Date.parse(g.m.created_at) <= WINDOW_MS) g.more.push(m)
    else out.push({ m, more: [] })
  }
  return out
}
