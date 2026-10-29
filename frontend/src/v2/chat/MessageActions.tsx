import { useEffect, useRef, useState } from 'react'
import { Button, Modal, Text } from '@mantine/core'
import { Icon } from '@/v2/parent/Icon'
import { ConfirmDelete } from '@/v2/manage/ConfirmDelete'
import { useDeleteMessage, useEditMessage, type ChatMessage } from '@/v2/hooks/useChat'
import { toastFail, toastOk } from '@/v2/notify'
import { ReactBar } from './Reactions'

const WINDOW_MS = 5 * 60_000 // mirrors the server's DELETE_WINDOW; the server stays the authority

/** Which actions to offer; the UI only hides what the server would refuse. */
export function allowed(m: ChatMessage, mine: boolean, kid: boolean) {
  if (m.kind !== 'user') return { edit: false, del: false }
  const fresh = !kid || Date.now() - new Date(m.created_at).getTime() <= WINDOW_MS
  return { edit: mine && fresh, del: (mine && fresh) || !kid }
}

/**
 * Hover / focus / long-press wrapper: a Teams-style pill on the bubble's top edge with
 * React, Edit and Delete (the last two only when allowed), at the upper right.
 */
export function MessageActions({
  m,
  mine,
  kid,
  onEdit,
  children,
}: {
  m: ChatMessage
  mine: boolean
  kid: boolean
  onEdit: () => void
  children: React.ReactNode
}) {
  const del = useDeleteMessage(kid)
  const [asking, setAsking] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [reacting, setReacting] = useState(false)
  const [low, setLow] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const can = allowed(m, mine, kid)
  if (m.kind !== 'user') return <>{children}</>

  const press = () => {
    timer.current = setTimeout(() => setPressed(true), 500)
  }
  const release = () => clearTimeout(timer.current)
  // the pill sits above the bubble; if the chat column would clip it, put it on the bottom edge
  const place = (el: HTMLElement) => {
    const top = el.closest('[data-chat-scroll]')?.getBoundingClientRect().top ?? 0
    setLow(el.getBoundingClientRect().top - 40 < top)
  }
  const remove = () =>
    del.mutate(m.id, { onSuccess: () => toastOk('Deleted'), onError: toastFail })
  const body = 'This message will be gone for everyone.'

  return (
    <div
      className="msg-act"
      data-mine={mine}
      data-pressed={pressed}
      data-open={reacting}
      data-low={low}
      onMouseEnter={(e) => place(e.currentTarget)}
      onFocus={(e) => place(e.currentTarget)}
      onTouchStart={(e) => (place(e.currentTarget), press())}
      onTouchEnd={release}
      onTouchMove={release}
      onTouchCancel={release}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPressed(false)
      }}
      // portaled dialogs/pickers still bubble React events here: their Escape must not close the chat dock
      onKeyDown={(e) => e.key === 'Escape' && !e.currentTarget.contains(e.target as Node) && e.stopPropagation()}
    >
      {children}
      <span className="msg-act-tools">
        <ReactBar m={m} kid={kid} onOpen={setReacting} />
        {can.edit && (
          <button type="button" className="msg-act-btn" aria-label="Edit message" title="Edit" onClick={() => (setPressed(false), onEdit())}>
            <Icon name="edit" size={16} />
          </button>
        )}
        {can.del && (
          <button type="button" className="msg-act-btn" data-danger aria-label="Delete message" title="Delete" onClick={() => (setPressed(false), setAsking(true))}>
            <Icon name="delete" size={16} />
          </button>
        )}
      </span>
      {kid ? (
        <Modal opened={asking} onClose={() => setAsking(false)} title="Delete this message?" centered zIndex={400}>
          <Text mb="md">{body}</Text>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="default" onClick={() => setAsking(false)}>
              Keep
            </Button>
            <Button
              color="red"
              onClick={() => {
                setAsking(false)
                remove()
              }}
            >
              Delete
            </Button>
          </div>
        </Modal>
      ) : (
        <ConfirmDelete opened={asking} title="Delete this message?" body={body} onConfirm={remove} onClose={() => setAsking(false)} />
      )}
    </div>
  )
}

/** Inline editor: Enter saves, Shift+Enter newline, Esc cancels. */
export function EditBox({ m, kid, onDone }: { m: ChatMessage; kid: boolean; onDone: () => void }) {
  const edit = useEditMessage(kid)
  const [text, setText] = useState(m.body ?? '')
  const ref = useRef<HTMLTextAreaElement>(null)
  // the menu hands focus back to its button as it closes; take it back after
  useEffect(() => {
    const t = setTimeout(() => {
      const el = ref.current
      el?.focus()
      el?.setSelectionRange(el.value.length, el.value.length)
    }, 50)
    return () => clearTimeout(t)
  }, [])
  const save = () => {
    const body = text.trim()
    if (!body || edit.isPending) return
    if (body === (m.body ?? '')) return onDone()
    edit.mutate(
      { id: m.id, body },
      {
        onSuccess: () => {
          toastOk('Saved')
          onDone()
        },
        onError: toastFail,
      },
    )
  }
  return (
    <textarea
      aria-label="Edit message"
      ref={ref}
      className="msg-edit"
      value={text}
      rows={2}
      maxLength={2000}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          save()
        } else if (e.key === 'Escape') {
          e.stopPropagation() // cancel the edit, not the chat dock around it
          onDone()
        }
      }}
    />
  )
}
