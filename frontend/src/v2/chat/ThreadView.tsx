import { useEffect, useRef, useState } from 'react'
import { Button, Modal } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconPhoto } from '@tabler/icons-react'
import { GifPicker } from '@/v2/chat/GifPicker'
import { Icon } from '@/v2/parent/Icon'
import { HeaderChips } from '@/v2/parent/HeaderChips'
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
import { LoadError, LoadingCards } from '@/v2/components/States'
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
  const wideLay = useMediaQuery('(min-width: 1250px)')

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

  // For parent look, render with header and optional side panel
  if (!kid) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', gap: 0 }}>
        {/* Header with title and chips */}
        {data && (
          <div style={{ paddingBottom: 16, borderBottom: '1.5px solid var(--p-line)', display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--p-acc)', color: '#292928', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={kind === 'chore' ? 'task' : kind === 'family' ? 'group' : 'mail'} size={24} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--p-ink)', marginBottom: 6 }}>{data.title}</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {kind === 'chore' && (
                  <>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '12px', fontWeight: 600, padding: '4px 10px 4px 8px', borderRadius: 999, background: 'var(--p-soft)', border: '1.5px solid var(--p-line)', color: 'var(--p-ink)', whiteSpace: 'nowrap' }}>
                      <Icon name="category" size={15} />
                      Chore
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '12px', fontWeight: 600, padding: '4px 10px 4px 8px', borderRadius: 999, background: 'var(--p-lav)', border: '1.5px solid var(--p-lav)', color: 'var(--p-lavink)', whiteSpace: 'nowrap' }}>
                      <Icon name="hourglass_top" size={15} />
                      Needs OK
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '12px', fontWeight: 600, padding: '4px 10px 4px 8px', borderRadius: 999, background: 'var(--p-soft)', border: '1.5px solid var(--p-line)', color: 'var(--p-ink)', whiteSpace: 'nowrap' }}>
                      <Icon name="stars" size={15} />
                      30 pts
                    </span>
                  </>
                )}
              </div>
            </div>
            {kind === 'chore' && (
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Button size="sm" variant="filled" color="var(--p-acc)">
                  <Icon name="check" size={16} />
                  Approve
                </Button>
                <Button size="sm" variant="default">
                  <Icon name="undo" size={16} />
                  Send back
                </Button>
                <Button size="sm" variant="default" style={{ color: 'var(--p-red)' }}>
                  <Icon name="remove_circle" size={16} />
                  Deduct
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Main content with optional side panel */}
        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
          {/* Messages column */}
          <section aria-label={data?.title ?? 'Conversation'} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
            {thread.isError && <LoadError error={thread.error} onRetry={() => thread.refetch()} />}
            {thread.isPending && !thread.isError && <LoadingCards n={3} h={48} />}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px', minHeight: 240 }}>
              {(hasMore ?? data?.has_more) && (
                <Button variant="default" size="xs" onClick={loadEarlier} style={{ alignSelf: 'center' }}>
                  Load earlier
                </Button>
              )}
              {data && messages.length === 0 && <p style={{ color: 'var(--p-sub)', fontStyle: 'italic' }}>Nothing here yet. Say hi!</p>}
              {messages.map((m) => {
                const d = dayLabel(m.created_at)
                const sep = d !== day
                day = d
                return (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
                    {sep && <div data-testid="day-sep" style={{ textAlign: 'center', margin: '8px 0', fontSize: '0.85rem', color: 'var(--p-sub)', fontWeight: 600 }}>{d}</div>}
                    <Bubble m={m} mine={m.author_id !== null && m.author_id === meId} />
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>
            <form
              style={{ flexWrap: 'nowrap', alignItems: 'flex-end', paddingTop: 8, position: 'sticky', bottom: 0, background: 'var(--p-bg, transparent)', display: 'flex', gap: 8 }}
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
                size="sm"
              >
                <IconPhoto size={18} />
              </Button>
              {gifsOn && (
                <Button variant="default" aria-label="Add GIF" onClick={() => setGifOpen(true)} size="sm">
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
                style={{ flex: 1, minWidth: 0, resize: 'none', font: 'inherit', padding: 8, borderRadius: 6, border: '1.5px solid var(--p-line)', background: 'var(--p-card)', color: 'var(--p-ink)' }}
              />
              <Button type="submit" disabled={!canSend} size="sm">
                Send
              </Button>
            </form>
            {gifsOn && data && (
              <GifPicker threadId={data.id} kid={kid} opened={gifOpen} onClose={() => setGifOpen(false)} onPicked={sendGif} />
            )}
          </section>

          {/* Side panel for chore threads (hidden on narrow screens) */}
          {wideLay && kind === 'chore' && (
            <div style={{ width: 250, borderLeft: '1.5px solid var(--p-line)', paddingLeft: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Steps card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px 0', color: 'var(--p-ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="checklist" size={18} />
                  Steps
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, fontSize: '13px', color: 'var(--p-sub)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1.5px solid var(--p-line)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="check_circle" size={16} /> Math worksheet</span>
                    <span style={{ fontSize: '12px' }}>5:02</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1.5px solid var(--p-line)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="check_circle" size={16} /> Check answers</span>
                    <span style={{ fontSize: '12px' }}>5:30</span>
                  </div>
                </div>
              </div>

              {/* Photos card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px 0', color: 'var(--p-ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="photo_library" size={18} />
                  Photos
                </h3>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ width: 96, height: 70, borderRadius: 8, background: 'var(--p-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--p-sub)' }}>
                    <Icon name="image" size={24} />
                  </div>
                  <div style={{ width: 96, height: 70, borderRadius: 8, background: 'var(--p-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--p-sub)' }}>
                    <Icon name="image" size={24} />
                  </div>
                </div>
              </div>

              {/* Kid today card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px 0', color: 'var(--p-ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="person" size={18} />
                  Mia today
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, fontSize: '13px', color: 'var(--p-sub)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1.5px solid var(--p-line)' }}>
                    <span>Chores</span>
                    <span style={{ color: 'var(--p-ink)', fontWeight: 600 }}>3 / 5</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1.5px solid var(--p-line)' }}>
                    <span>Points</span>
                    <span style={{ color: 'var(--p-ink)', fontWeight: 600 }}>860</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1.5px solid var(--p-line)' }}>
                    <span>iPad</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--p-acc)', color: '#292928', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Open</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
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
