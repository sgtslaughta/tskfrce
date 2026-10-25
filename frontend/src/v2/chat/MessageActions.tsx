import { useEffect, useRef, useState } from 'react'
import { Button, Menu, Modal, Text } from '@mantine/core'
import { Icon } from '@/v2/parent/Icon'
import { ConfirmDelete } from '@/v2/manage/ConfirmDelete'
import { useDeleteMessage, useEditMessage, type ChatMessage } from '@/v2/hooks/useChat'
import { toastFail, toastOk } from '@/v2/notify'

const WINDOW_MS = 5 * 60_000 // mirrors the server's DELETE_WINDOW; the server stays the authority

/** Which actions to offer; the UI only hides what the server would refuse. */
export function allowed(m: ChatMessage, mine: boolean, kid: boolean) {
  if (m.kind !== 'user') return { edit: false, del: false }
  const fresh = !kid || Date.now() - new Date(m.created_at).getTime() <= WINDOW_MS
  return { edit: mine && fresh, del: (mine && fresh) || !kid }
}

/** Hover / focus / long-press wrapper with a "..." menu: Edit and Delete. */
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
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const can = allowed(m, mine, kid)
  if (!can.edit && !can.del) return <>{children}</>

  const press = () => {
    timer.current = setTimeout(() => setPressed(true), 500)
  }
  const release = () => clearTimeout(timer.current)
  const remove = () =>
    del.mutate(m.id, { onSuccess: () => toastOk('Deleted'), onError: toastFail })
  const body = 'This message will be gone for everyone.'

  return (
    <div
      className="msg-act"
      data-pressed={pressed}
      onTouchStart={press}
      onTouchEnd={release}
      onTouchMove={release}
      onTouchCancel={release}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPressed(false)
      }}
    >
      {children}
      <Menu position="bottom-end" withinPortal onClose={() => setPressed(false)}>
        <Menu.Target>
          <button type="button" className="msg-act-btn" aria-label="Message actions">
            <Icon name="more_horiz" size={18} />
          </button>
        </Menu.Target>
        <Menu.Dropdown>
          {can.edit && <Menu.Item onClick={onEdit}>Edit</Menu.Item>}
          {can.del && (
            <Menu.Item color="red" onClick={() => setAsking(true)}>
              Delete
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>
      {kid ? (
        <Modal opened={asking} onClose={() => setAsking(false)} title="Delete this message?" centered>
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
    const t = setTimeout(() => ref.current?.focus(), 0)
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
        } else if (e.key === 'Escape') onDone()
      }}
    />
  )
}
