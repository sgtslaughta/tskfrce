import { useEffect, useRef, useState } from 'react'
import { Button, Drawer } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconArrowLeft, IconX } from '@tabler/icons-react'
import { refOf, useThread, useThreads, validRef, type ThreadKind } from '@/v2/hooks/useChat'
import { OPEN_CHAT_EVENT, OPEN_CHAT_LIST_EVENT, type ChatReply } from './dock'
import { ErrorPanel, Skeleton } from '@/v2/parent/states'
import { shownTitle, ThreadList } from './ThreadList'
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

/** Chat opened by openChat / openChatList (no launcher: parents use the rail / tab bar, kids their nav).
 *  Parents get a bottom sheet on phones (mockup 04) and a floating panel on desktop; kids a panel. */
export function ChatDock({ kid = false, meId, meName, inline = false }: { kid?: boolean; meId: number | null; meName?: string; inline?: boolean }) {
  const [open, setOpen] = useState(inline) // inline: always shown, the kid Chat tab hosts it
  const [pick, setPick] = useState<Pick | null>(null)
  const [reply, setReply] = useState<{ to: ChatReply; n: number } | null>(null) // n remounts the composer per request
  const panel = useRef<HTMLDivElement>(null)
  const opener = useRef<Element | null>(null) // what had focus before the dock opened
  const threads = useThreads(kid)
  const phone = useMediaQuery('(max-width: 767px)')
  const sheet = !kid && !!phone

  // restore after mount (sessionStorage is client-only)
  useEffect(() => {
    if (!kid) return
    const s = load()
    setOpen(inline || s.open)
    setPick(s.pick)
  }, [kid, inline])
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<Pick & { reply?: ChatReply }>).detail
      if (!d || !validRef(d.kind, d.ref)) return
      setPick({ kind: d.kind, ref: d.ref })
      setReply((r) => (d.reply ? { to: d.reply, n: (r?.n ?? 0) + 1 } : null))
      if (!panel.current?.contains(document.activeElement)) opener.current = document.activeElement
      setOpen(true)
      if (kid) save(true, { kind: d.kind, ref: d.ref })
    }
    const list = () => {
      setPick(null)
      setReply(null)
      setOpen(true)
      if (kid) save(true, null)
    }
    window.addEventListener(OPEN_CHAT_EVENT, on)
    window.addEventListener(OPEN_CHAT_LIST_EVENT, list)
    return () => {
      window.removeEventListener(OPEN_CHAT_EVENT, on)
      window.removeEventListener(OPEN_CHAT_LIST_EVENT, list)
    }
  }, [kid])
  // keep focus inside the panel when it opens or switches thread, so Escape always reaches it
  useEffect(() => {
    if (open && !inline && !panel.current?.contains(document.activeElement)) panel.current?.focus()
  }, [open, pick, inline])

  const set = (o: boolean, p: Pick | null) => {
    setOpen(o)
    setPick(p)
    if (p !== pick) setReply(null)
    if (kid) save(o, p)
  }
  const close = () => {
    set(inline, pick)
    if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus()
    opener.current = null
  }
  const page = useThread(pick?.kind ?? null, pick?.ref ?? null, kid) // same query as the open ThreadView
  const title =
    pick && threads.data?.threads.find((t) => t.kind === pick.kind && refOf(t) === pick.ref)?.title

  const head = pick ? shownTitle({ kind: pick.kind, title: page.data?.title || title || 'Chat' }, kid) : 'Chat'
  const back = pick && (
    <Button variant="subtle" size="compact-md" aria-label="Back to conversations" onClick={() => set(true, null)}>
      <IconArrowLeft size={18} />
    </Button>
  )
  const listState = threads.isError ? (
    <ErrorPanel kind="unreachable" error={threads.error} onRetry={() => threads.refetch()} />
  ) : threads.isPending ? (
    <Skeleton rows={3} />
  ) : null
  const body = pick ? (
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
      <ThreadList
        empty={listState}
        threads={threads.data?.threads ?? []}
        selected={null}
        meName={meName}
        kid={kid}
        loaded={!!threads.data}
        onPick={(t) => set(true, { kind: t.kind, ref: refOf(t) })}
      />
    </>
  )

  if (sheet) {
    return (
      <Drawer
        opened={open}
        onClose={close}
        position="bottom"
        size="58%"
        title={
          <>
            {back}
            {head}
            {pick && page.data?.who && <small className="pt-sheet-sub">{page.data.who}</small>}
          </>
        }
        classNames={{ content: 'pt-sheet', body: 'pt-sheet-body' }}
      >
        {body}
      </Drawer>
    )
  }

  if (!open) return null
  return (
    <div
      id="f-chat-dock"
      ref={panel}
      role={inline ? 'region' : 'dialog'}
      aria-label="Chat"
      tabIndex={-1}
      className={`f-dock${kid ? ' k-tok k-chat' : ''}${inline ? ' f-dock-inline' : ''}`}
      // kid dock reuses the parent chat layout, with --p-* mapped to kid tokens (chatDock.css)
      data-look={kid ? 'parent' : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          close()
        }
      }}
    >
      {!(kid && inline && !pick) && (<div className="f-dock-head">
        {back}
        <h2>
          {head}
          {pick && page.data?.who && !kid && <small className="f-dock-who"> · {page.data.who}</small>}
        </h2>
        {!inline && (
          <Button variant="subtle" size="compact-md" aria-label="Close chat" onClick={close}>
            <IconX size={18} />
          </Button>
        )}
      </div>)}
      <div className="f-dock-body">{body}</div>
    </div>
  )
}
