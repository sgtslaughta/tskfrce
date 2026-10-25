import { Fragment, useEffect, useRef, useState } from 'react'
import { Button } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconPhoto } from '@tabler/icons-react'
import { GifPicker } from '@/v2/chat/GifPicker'
import { Icon } from '@/v2/parent/Icon'
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
import { useRunDetail } from '@/v2/hooks/useChores'
import { LoadError, LoadingCards } from '@/v2/components/States'
import { toastFail } from '@/v2/notify'
import { Photo } from './ChatPhoto'
import { DaySep, ParentBubble, dayName } from './ParentBubble'
import { ThreadHead } from './ThreadHead'
import { ThreadSidePanel } from './ThreadSidePanel'

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

function Bubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  if (m.kind === 'system') {
    return (
      <div data-testid="msg-system" style={{ textAlign: 'center', margin: '8px 0', fontSize: '0.85rem', color: 'var(--p-sub)' }}>
        <Icon name="task_alt" size={16} />
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
      {!mine && <span style={{ fontSize: '0.85rem', color: 'var(--p-sub)' }}>{m.author_name ?? 'Someone'}</span>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: '1.5px solid var(--p-line)',
            background: mine ? 'var(--p-acc)' : 'var(--p-card)',
            color: mine ? '#292928' : 'inherit',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
        >
          {m.photo_url && <Photo url={m.photo_url} />}
          {m.body}
        </div>
      </div>
      <span style={{ fontSize: '0.85rem', color: 'var(--p-sub)', alignSelf: mine ? 'flex-end' : 'flex-start' }}>{timeLabel(m.created_at)}</span>
    </div>
  )
}

/** One conversation: messages (newest at the bottom), "Load earlier", and a composer. */
export function ThreadView({
  kind,
  refId,
  meId,
  kid = false,
  bare = false,
}: {
  kind: ThreadKind
  refId: string
  meId: number | null
  kid?: boolean
  bare?: boolean
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
  const wideLay = useMediaQuery('(min-width: 1250px)')

  const data = thread.data
  const runDetail = useRunDetail(kind === 'chore' ? Number(refId) : null)
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

  // Parent look: header, messages, composer, side panel
  if (!kid) {
    const run = kind === 'chore' ? runDetail.data : undefined
    const sideKid = kind === 'private' ? Number(refId) : (run?.kid_ids[0] ?? null)
    const side = wideLay && !bare && ((kind === 'chore' && !!run) || kind === 'private')
    return (
      <div className="pc-grid" data-side={side} data-bare={bare}>
        <section className="pc-thread" aria-label={data?.title ?? 'Conversation'}>
          {data && !bare && <ThreadHead kind={kind} title={data.title} run={run} />}
          {thread.isError && <LoadError error={thread.error} onRetry={() => thread.refetch()} />}
          {thread.isPending && !thread.isError && <LoadingCards n={3} h={48} />}
          <div className="pc-msgs">
            {(hasMore ?? data?.has_more) && (
              <Button variant="default" size="xs" onClick={loadEarlier} style={{ alignSelf: 'center' }}>
                Load earlier
              </Button>
            )}
            {data && messages.length === 0 && <p className="pc-empty">Nothing here yet. Say hi!</p>}
            {messages.map((m) => {
              const d = dayName(m.created_at)
              const sep = d !== day
              day = d
              return (
                <Fragment key={m.id}>
                  {sep && <DaySep label={d} />}
                  <ParentBubble m={m} mine={m.author_id !== null && m.author_id === meId} />
                </Fragment>
              )
            })}
            <div ref={endRef} />
          </div>
          <form
            className="pc-reply"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden aria-label="Photo file" onChange={(e) => pick(e.target.files?.[0])} />
            <button type="button" className="pc-ib" data-on={!!photoId} aria-label={photoId ? 'Photo added' : 'Add photo'} disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
              <Icon name={photoId ? 'image' : 'add_photo_alternate'} size={20} />
            </button>
            {gifsOn && (
              <button type="button" className="pc-ib" aria-label="Add GIF" onClick={() => setGifOpen(true)}>
                <Icon name="gif_box" size={20} />
              </button>
            )}
            <textarea
              aria-label="Message"
              value={text}
              rows={1}
              maxLength={2000}
              placeholder={data ? `Message ${data.title}…` : 'Write a message'}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <button type="submit" className="pc-send" aria-label="Send" disabled={!canSend}>
              <Icon name="send" size={16} />
            </button>
          </form>
          {gifsOn && data && (
            <GifPicker threadId={data.id} kid={kid} opened={gifOpen} onClose={() => setGifOpen(false)} onPicked={sendGif} />
          )}
        </section>
        {side && <ThreadSidePanel run={run} kidId={sideKid} />}
      </div>
    )
  }

  // For kid look, use original layout
  return (
    <section aria-label={data?.title ?? 'Conversation'} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {thread.isError && <LoadError error={thread.error} onRetry={() => thread.refetch()} />}
      {thread.isPending && !thread.isError && <LoadingCards n={3} h={48} />}
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
