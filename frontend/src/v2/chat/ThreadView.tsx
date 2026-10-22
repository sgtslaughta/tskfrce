import { useEffect, useRef, useState } from 'react'
import { Button, Modal } from '@mantine/core'
import { IconPhoto } from '@tabler/icons-react'
import { GifPicker } from '@/v2/chat/GifPicker'
import {
  fetchEarlier,
  useMarkRead,
  usePost,
  useThread,
  useThreads,
  useUploadChatPhoto,
  type ChatMessage,
  type ThreadKind,
} from '@/v2/hooks/useChat'
import { toastFail } from '@/v2/notify'
import { useAuthImage } from '@/v2/today/PhotoViewer'

/** Server photo paths are `/api/v1/...`; the proxy wants them without that prefix. */
const proxyPath = (url: string) => url.replace(/^\/api\/v1/, '')

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

function Photo({ url }: { url: string }) {
  const [open, setOpen] = useState(false)
  const path = proxyPath(url)
  const thumb = useAuthImage(`${path}/thumb`)
  const full = useAuthImage(open ? path : null)
  return (
    <>
      <button
        type="button"
        aria-label="Open photo"
        onClick={() => setOpen(true)}
        style={{ display: 'block', width: 160, height: 120, padding: 0, border: 0, borderRadius: 6, overflow: 'hidden', background: 'var(--f-mute)', cursor: 'pointer' }}
      >
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </button>
      <Modal opened={open} onClose={() => setOpen(false)} title="Photo" size="lg" transitionProps={{ duration: 0 }}>
        {full && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={full} alt="Chat photo" style={{ width: '100%', borderRadius: 6 }} />
        )}
      </Modal>
    </>
  )
}

function Bubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  if (m.kind === 'system') {
    return (
      <div data-testid="msg-system" className="f-cap" style={{ textAlign: 'center', margin: '8px 0' }}>
        {m.body}
        {m.photo_url && <Photo url={m.photo_url} />}
      </div>
    )
  }
  return (
    <div
      data-testid={mine ? 'msg-mine' : 'msg-other'}
      style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      {!mine && <span className="f-cap">{m.author_name ?? 'Someone'}</span>}
      <div
        style={{
          padding: '8px 12px',
          borderRadius: 10,
          border: '1.5px solid var(--f-edge)',
          background: mine ? 'var(--f-ink)' : 'var(--f-card)',
          color: mine ? 'var(--f-card)' : 'inherit',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {m.photo_url && <Photo url={m.photo_url} />}
        {m.body}
      </div>
      <span className="f-cap" style={{ alignSelf: mine ? 'flex-end' : 'flex-start' }}>{timeLabel(m.created_at)}</span>
    </div>
  )
}

/** One conversation: messages (newest at the bottom), "Load earlier", and a composer. */
export function ThreadView({
  kind,
  refId,
  meId,
  kid = false,
}: {
  kind: ThreadKind
  refId: string
  meId: number | null
  kid?: boolean
}) {
  const thread = useThread(kind, refId, kid)
  const post = usePost(kid)
  const upload = useUploadChatPhoto(kid)
  const gifsOn = !!useThreads(kid).data?.gifs_enabled
  const [gifOpen, setGifOpen] = useState(false)
  const markRead = useMarkRead(kid)
  const [older, setOlder] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState<boolean | null>(null)
  const [text, setText] = useState('')
  const [photoId, setPhotoId] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const data = thread.data
  const latest = data?.messages ?? []
  const lastId = latest.length ? latest[latest.length - 1].id : 0
  const messages = [...older.filter((o) => !latest.some((l) => l.id === o.id)), ...latest]

  // opening (and every new message while open) marks the thread read
  const { mutate } = markRead
  useEffect(() => {
    if (data?.id) mutate(data.id)
  }, [data?.id, lastId, mutate])
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [lastId])

  const loadEarlier = async () => {
    if (!messages.length) return
    try {
      const page = await fetchEarlier(kind, refId, messages[0].id, kid)
      setOlder((o) => [...page.messages, ...o])
      setHasMore(page.has_more)
    } catch (e) {
      toastFail(e)
    }
  }

  const canSend = (text.trim().length > 0 || photoId !== null) && !post.isPending && !!data
  const send = async () => {
    if (!canSend || !data) return
    try {
      await post.mutateAsync({ threadId: data.id, body: text.trim(), photoId: photoId ?? undefined })
      setText('')
      setPhotoId(null)
    } catch (e) {
      toastFail(e)
    }
  }
  const sendGif = async (id: number) => {
    if (!data) return
    await post.mutateAsync({ threadId: data.id, body: text.trim(), photoId: id })
    setText('')
  }
  const pick = async (file?: File) => {
    if (!file || !data) return
    try {
      setPhotoId((await upload.mutateAsync({ threadId: data.id, file })).photo_id)
    } catch (e) {
      toastFail(e)
    }
  }

  let day = ''
  return (
    <section aria-label={data?.title ?? 'Conversation'} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {thread.isError && <p role="alert">{thread.error.message}</p>}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px', minHeight: 240 }}>
        {(hasMore ?? data?.has_more) && (
          <Button variant="default" size="xs" onClick={loadEarlier} style={{ alignSelf: 'center' }}>
            Load earlier
          </Button>
        )}
        {data && messages.length === 0 && <p className="f-note">Nothing here yet. Say hi!</p>}
        {messages.map((m) => {
          const d = dayLabel(m.created_at)
          const sep = d !== day
          day = d
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
              {sep && <div className="f-cap" data-testid="day-sep" style={{ textAlign: 'center', margin: '8px 0' }}>{d}</div>}
              <Bubble m={m} mine={m.author_id !== null && m.author_id === meId} />
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <form
        className="f-row"
        style={{ flexWrap: 'nowrap', alignItems: 'flex-end', paddingTop: 8, position: 'sticky', bottom: 0, background: 'var(--f-bg, transparent)' }}
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden aria-label="Photo file" onChange={(e) => pick(e.target.files?.[0])} />
        <Button
          variant={photoId ? 'filled' : 'default'}
          aria-label={photoId ? 'Photo added' : 'Add photo'}
          onClick={() => fileRef.current?.click()}
          loading={upload.isPending}
        >
          <IconPhoto size={18} />
        </Button>
        {gifsOn && (
          <Button variant="default" aria-label="Add GIF" onClick={() => setGifOpen(true)}>
            GIF
          </Button>
        )}
        <textarea
          aria-label="Message"
          value={text}
          rows={1}
          maxLength={2000}
          placeholder="Write a message"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          style={{ flex: 1, minWidth: 0, resize: 'none', font: 'inherit', padding: 8 }}
        />
        <Button type="submit" disabled={!canSend}>
          Send
        </Button>
      </form>
      {gifsOn && data && (
        <GifPicker threadId={data.id} kid={kid} opened={gifOpen} onClose={() => setGifOpen(false)} onPicked={sendGif} />
      )}
    </section>
  )
}
