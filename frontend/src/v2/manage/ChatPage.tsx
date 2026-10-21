import { useState } from 'react'
import { useRouter } from 'next/router'
import { Button } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { ThreadList } from '@/v2/chat/ThreadList'
import { ThreadView } from '@/v2/chat/ThreadView'
import { FridgeShell } from '@/v2/components/FridgeShell'
import { RequireParent } from '@/v2/components/RequireParent'
import { refOf, useThreads, type ThreadKind } from '@/v2/hooks/useChat'

type Pick = { kind: ThreadKind; ref: string }

/** From ?kid=<id>, ?chore=<task id> or ?family. */
function fromQuery(q: Record<string, string | string[] | undefined>): Pick | null {
  if (typeof q.kid === 'string') return { kind: 'private', ref: q.kid }
  if (typeof q.chore === 'string') return { kind: 'chore', ref: q.chore }
  if (q.family !== undefined) return { kind: 'family', ref: 'family' }
  return null
}

function ChatBody() {
  const router = useRouter()
  const { user } = useUnifiedAuth()
  const phone = useMediaQuery('(max-width: 768px)')
  const threads = useThreads()
  const [picked, setPicked] = useState<Pick | null>(null)
  const sel = picked ?? fromQuery(router.query)

  const list = (
    <ThreadList
      threads={threads.data?.threads ?? []}
      selected={sel ? `${sel.kind}:${sel.ref}` : null}
      onPick={(t) => setPicked({ kind: t.kind, ref: refOf(t) })}
    />
  )
  const view = sel ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      {phone && (
        <Button variant="default" size="xs" onClick={() => { setPicked(null); void router.replace('/chat') }} style={{ alignSelf: 'flex-start' }}>
          Back
        </Button>
      )}
      <ThreadView key={`${sel.kind}:${sel.ref}`} kind={sel.kind} refId={sel.ref} meId={user ? Number(user.id) : null} />
    </div>
  ) : (
    <p className="f-note">Pick a conversation.</p>
  )

  return (
    <FridgeShell title="Chat">
      {threads.isError && <p role="alert">{threads.error.message}</p>}
      {phone ? (
        sel ? view : list
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 2fr', gap: 16, height: 'calc(100vh - 180px)', minHeight: 360 }}>
          <div style={{ overflowY: 'auto' }}>{list}</div>
          <div className="f-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>{view}</div>
        </div>
      )}
    </FridgeShell>
  )
}

export function ChatPage() {
  return (
    <RequireParent>
      <ChatBody />
    </RequireParent>
  )
}
