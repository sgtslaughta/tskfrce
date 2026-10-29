import { useMediaQuery } from '@mantine/hooks'
import { useRouter } from 'next/router'
import { ParentShell } from '@/v2/parent/ParentShell'
import { NoChats, ThreadList } from '@/v2/chat/ThreadList'
import { ThreadView } from '@/v2/chat/ThreadView'
import { RequireParent } from '@/v2/components/RequireParent'
import { ErrorPanel, Skeleton } from '@/v2/parent/states'
import { refOf, useThreads } from '@/v2/hooks/useChat'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import type { ThreadSummary } from '@/v2/hooks/useChat'

/** Parent chat page with list/detail layout */
function ChatPageBody() {
  const router = useRouter()
  const { user } = useUnifiedAuth()
  const threads = useThreads(false)

  const small = useMediaQuery('(max-width: 767px)')
  const list = threads.data?.threads ?? []
  // ?item=<kind>:<ref> (ref = run id, kid id or "family"); desktop falls back to the first thread
  const item = typeof router.query.item === 'string' ? router.query.item : null
  const picked = list.find((t) => `${t.kind}:${refOf(t)}` === item)
  // a chore without messages has no list row yet; ?item=chore:<run id> still opens it
  const bareChore = !picked && threads.data ? item?.match(/^chore:(\d+)$/)?.[1] : undefined
  const selected = picked ?? (small || bareChore ? null : list[0] ?? null)

  const handlePick = (t: ThreadSummary) => {
    void router.push({ query: { item: `${t.kind}:${refOf(t)}` } }, undefined, { shallow: true })
  }

  // phones hide the detail pane, so loading, error and empty states go in the list
  const phoneState = threads.data ? (
    list.length === 0 ? <NoChats /> : null
  ) : threads.isError ? (
    <ErrorPanel kind="unreachable" error={threads.error} onRetry={() => threads.refetch()} />
  ) : threads.isPending ? (
    <Skeleton rows={3} />
  ) : null
  const listContent = <ThreadList threads={list} selected={selected ? `${selected.kind}:${refOf(selected)}` : null} onPick={handlePick} meName={user?.username} empty={small ? phoneState : null} loaded={!!threads.data} />

  const detailContent = bareChore ? (
    <ThreadView key={item} kind="chore" refId={bareChore} meId={user ? Number(user.id) : null} />
  ) : selected ? (
    <ThreadView key={`${selected.kind}:${refOf(selected)}`} kind={selected.kind} refId={refOf(selected)} meId={user ? Number(user.id) : null} />
  ) : threads.data ? (
    <NoChats />
  ) : null

  return (
    <ParentShell title="Chat" list={listContent}>
      {!small && !threads.data && (threads.isError ? <ErrorPanel kind="unreachable" error={threads.error} onRetry={() => threads.refetch()} /> : <Skeleton />)}
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
