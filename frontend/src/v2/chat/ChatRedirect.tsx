import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { openChat } from '@/v2/chat/dock'
import { ParentShell } from '@/v2/parent/ParentShell'
import { RequireParent } from '@/v2/components/RequireParent'
import type { ThreadKind } from '@/v2/hooks/useChat'

/** From ?kid=<id>, ?chore=<task id> or ?family; openChat validates the ref. */
function fromQuery(q: Record<string, string | string[] | undefined>): [ThreadKind, string] | null {
  if (typeof q.kid === 'string') return ['private', q.kid]
  if (typeof q.chore === 'string') return ['chore', q.chore]
  if (q.family !== undefined) return ['family', 'family']
  return null
}

/** Old /chat links: the chat now lives in the dock, so open it to the requested thread. */
function ChatBody() {
  const { query } = useRouter()
  const want = fromQuery(query)
  const [kind, ref] = want ?? [null, null]
  useEffect(() => {
    // wait a tick so the dock has registered its listener
    if (kind && ref) setTimeout(() => openChat(kind, ref), 0)
  }, [kind, ref])
  return (
    <ParentShell title="Chat">
      <p className="f-note">Chat lives in the button at the bottom right of every page.</p>
    </ParentShell>
  )
}

export function ChatRedirect() {
  return (
    <RequireParent>
      <ChatBody />
    </RequireParent>
  )
}
