import { useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { ParentShell } from '@/v2/parent/ParentShell'
import { ThreadList } from '@/v2/chat/ThreadList'
import { ThreadView } from '@/v2/chat/ThreadView'
import { RequireParent } from '@/v2/components/RequireParent'
import { LoadError, LoadingCards } from '@/v2/components/States'
import { useThreads } from '@/v2/hooks/useChat'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import type { ThreadSummary } from '@/v2/hooks/useChat'

/** Parent chat page with list/detail layout */
function ChatPageBody() {
  const router = useRouter()
  const { user } = useUnifiedAuth()
  const threads = useThreads(false)

  // Parse selected thread from URL query
  const selectedThread = useMemo(() => {
    const item = router.query.item
    if (!item || typeof item !== 'string') return null
    const [kind, ref] = item.split(':') as [any, string]
    if (!kind || !ref) return null
    return { kind, ref }
  }, [router.query.item])

  // Find the thread data for the selected thread
  const selectedThreadData = useMemo(() => {
    if (!selectedThread || !threads.data) return null
    const t = threads.data.threads.find(
      (t: ThreadSummary) => String(t.kind) === selectedThread.kind && String(t.id) === selectedThread.ref
    )
    return t || null
  }, [selectedThread, threads.data])

  const handlePick = (t: ThreadSummary) => {
    // Set the selected thread ID as the URL parameter
    void router.push({ query: { item: `${t.kind}:${t.id}` } }, undefined, { shallow: true })
  }

  const listContent = (
    <ThreadList
      threads={threads.data?.threads ?? []}
      selected={selectedThread ? `${selectedThread.kind}:${selectedThread.ref}` : null}
      onPick={handlePick}
    />
  )

  const detailContent = selectedThread && selectedThreadData ? (
    <ThreadView
      kind={selectedThread.kind}
      refId={selectedThread.ref}
      meId={user ? Number(user.id) : null}
      kid={false}
    />
  ) : (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--p-sub)' }}>
      Select a conversation to start chatting
    </div>
  )

  return (
    <ParentShell title="Chat" list={listContent}>
      {threads.isError && !threads.data && <LoadError error={threads.error} onRetry={() => threads.refetch()} />}
      {threads.isPending && !threads.data && <LoadingCards n={3} h={48} />}
      {detailContent}
    </ParentShell>
  )
}

export default function ChatPage() {
  return (
    <RequireParent>
      <ChatPageBody />
    </RequireParent>
  )
}
