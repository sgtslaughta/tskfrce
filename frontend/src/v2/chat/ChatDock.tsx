import { useEffect, useRef, useState } from 'react'
import { Button } from '@mantine/core'
import { IconArrowLeft, IconMessage, IconX } from '@tabler/icons-react'
import { refOf, useThreads, validRef, type ThreadKind } from '@/v2/hooks/useChat'
import { OPEN_CHAT_EVENT } from './dock'
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

/** Always-present floating chat: launcher button plus a thread list / thread panel. */
export function ChatDock({ kid = false, meId }: { kid?: boolean; meId: number | null }) {
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState<Pick | null>(null)
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
      const d = (e as CustomEvent<Pick>).detail
      if (!d || !validRef(d.kind, d.ref)) return
      setPick({ kind: d.kind, ref: d.ref })
      setOpen(true)
      save(true, { kind: d.kind, ref: d.ref })
    }
    window.addEventListener(OPEN_CHAT_EVENT, on)
    return () => window.removeEventListener(OPEN_CHAT_EVENT, on)
  }, [])
  useEffect(() => {
    if (open) panel.current?.focus()
  }, [open])

  const set = (o: boolean, p: Pick | null) => {
    setOpen(o)
    setPick(p)
    save(o, p)
  }
  const close = () => {
    set(false, pick)
    launcher.current?.focus()
  }
  const title =
    pick && threads.data?.threads.find((t) => t.kind === pick.kind && refOf(t) === pick.ref)?.title

  return (
    <div className={open ? 'f-dock-open' : undefined}>
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
            <h2>{pick ? title || 'Chat' : 'Chat'}</h2>
            <Button variant="subtle" size="compact-md" aria-label="Close chat" onClick={close}>
              <IconX size={18} />
            </Button>
          </div>
          <div className="f-dock-body">
            {pick ? (
              <ThreadView key={`${pick.kind}:${pick.ref}`} kind={pick.kind} refId={pick.ref} meId={meId} kid={kid} />
            ) : (
              <>
                {threads.isError && <p role="alert">{threads.error.message}</p>}
                <ThreadList
                  threads={threads.data?.threads ?? []}
                  selected={null}
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
