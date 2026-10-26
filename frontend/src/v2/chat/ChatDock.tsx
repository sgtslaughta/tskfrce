import { useEffect, useRef, useState } from 'react'
import { Button } from '@mantine/core'
import { IconArrowLeft, IconMessage, IconX } from '@tabler/icons-react'
import { refOf, useThread, useThreads, validRef, type ThreadKind } from '@/v2/hooks/useChat'
import { OPEN_CHAT_EVENT, OPEN_CHAT_LIST_EVENT, type ChatReply } from './dock'
import { LoadError, LoadingCards } from '@/v2/components/States'
import { ErrorPanel, Skeleton } from '@/v2/parent/states'
import { ThreadList } from './ThreadList'
import { ThreadView } from './ThreadView'

type Pick = { kind: ThreadKind; ref: string }
const KEY = 'task4ce-chat-dock'

function load(): { open: boolean; pick: Pick | null } {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    const p = s?.pick
    return { open: s?.open === true, pick: p && validRef(p.kind, p.ref) ? { kind: p.kind, ref: p.ref } : null }
  } catch {
    return { open: false, pick: null }
  }
}
function save(open: boolean, pick: Pick | null) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ open, pick }))
  } catch {
    /* storage unavailable */
  }
}

/** Always-present floating chat: launcher button plus a thread list / thread panel.
 *  `launcher={false}` hides the floating button only (the kid nav has a Chat item). */
export function ChatDock({ kid = false, meId, meName, launcher: showLauncher = true }: { kid?: boolean; meId: number | null; meName?: string; launcher?: boolean }) {
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState<Pick | null>(null)
  const [reply, setReply] = useState<{ to: ChatReply; n: number } | null>(null) // n remounts the composer per request
  const launcher = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const threads = useThreads(kid)
  const unread = threads.data?.total ?? 0

  // restore after mount (sessionStorage is client-only)
  useEffect(() => {
    const s = load()
    setOpen(s.open)
    setPick(s.pick)
  }, [])
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<Pick & { reply?: ChatReply }>).detail
      if (!d || !validRef(d.kind, d.ref)) return
      setPick({ kind: d.kind, ref: d.ref })
      setReply((r) => (d.reply ? { to: d.reply, n: (r?.n ?? 0) + 1 } : null))
      setOpen(true)
      save(true, { kind: d.kind, ref: d.ref })
    }
    const list = () => {
      setPick(null)
      setReply(null)
      setOpen(true)
      save(true, null)
    }
    window.addEventListener(OPEN_CHAT_EVENT, on)
    window.addEventListener(OPEN_CHAT_LIST_EVENT, list)
    return () => {
      window.removeEventListener(OPEN_CHAT_EVENT, on)
      window.removeEventListener(OPEN_CHAT_LIST_EVENT, list)
    }
  }, [])
  // keep focus inside the panel when it opens or switches thread, so Escape always reaches it
  useEffect(() => {
    if (open) panel.current?.focus()
  }, [open, pick])

  const set = (o: boolean, p: Pick | null) => {
    setOpen(o)
    setPick(p)
    if (p !== pick) setReply(null)
    save(o, p)
  }
  const close = () => {
    set(false, pick)
    launcher.current?.focus()
  }
  const page = useThread(pick?.kind ?? null, pick?.ref ?? null, kid) // same query as the open ThreadView
  const title =
    pick && threads.data?.threads.find((t) => t.kind === pick.kind && refOf(t) === pick.ref)?.title

  return (
    <div className={open ? 'f-dock-open' : undefined}>
      {showLauncher && (
        <button
          ref={launcher}
          type="button"
          className="f-dock-btn"
          aria-label={unread > 0 ? `Chat, ${unread} unread` : 'Chat'}
          aria-expanded={open}
          aria-controls="f-chat-dock"
          onClick={() => (open ? close() : set(true, pick))}
        >
          <IconMessage size={28} />
          {unread > 0 && (
            <span className="f-dock-badge" data-testid="dock-unread" aria-hidden="true">
              {unread}
            </span>
          )}
        </button>
      )}
      {open && (
        <div
          id="f-chat-dock"
          ref={panel}
          role="dialog"
          aria-label="Chat"
          tabIndex={-1}
          className="f-dock"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              close()
            }
          }}
        >
          <div className="f-dock-head">
            {pick && (
              <Button variant="subtle" size="compact-md" aria-label="Back to conversations" onClick={() => set(true, null)}>
                <IconArrowLeft size={18} />
              </Button>
            )}
            <h2>
              {pick ? page.data?.title || title || 'Chat' : 'Chat'}
              {pick && page.data?.who && <small className="f-dock-who"> · {page.data.who}</small>}
            </h2>
            <Button variant="subtle" size="compact-md" aria-label="Close chat" onClick={close}>
              <IconX size={18} />
            </Button>
          </div>
          <div className="f-dock-body">
            {pick ? (
              <ThreadView
                key={`${pick.kind}:${pick.ref}:${reply?.n ?? 0}`}
                kind={pick.kind}
                refId={pick.ref}
                meId={meId}
                kid={kid}
                bare
                reply={reply?.to}
              />
            ) : (
              <>
                {threads.isError && !kid && <ErrorPanel kind="unreachable" error={threads.error} onRetry={() => threads.refetch()} />}
                {threads.isError && kid && <LoadError error={threads.error} onRetry={() => threads.refetch()} />}
                {threads.isPending && (kid ? <LoadingCards n={3} h={56} /> : <Skeleton rows={3} />)}
                <ThreadList
                  threads={threads.data?.threads ?? []}
                  selected={null}
                  meName={meName}
                  kid={kid}
                  onPick={(t) => set(true, { kind: t.kind, ref: refOf(t) })}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
