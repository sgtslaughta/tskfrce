import { Fragment, useEffect, useRef, useState } from 'react'
import { Button, VisuallyHidden } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconPhoto } from '@tabler/icons-react'
import { GifPicker } from '@/v2/chat/GifPicker'
import { Icon } from '@/v2/parent/Icon'
import {
  fetchEarlier,
  onMessageChanged,
  useMarkRead,
  usePost,
  useThread,
  useThreads,
  useUploadChatPhoto,
  type ChatMessage,
  type ThreadKind,
} from '@/v2/hooks/useChat'
import { useSingleFlight } from '@/v2/hooks/useSingleFlight'
import { useRunDetail } from '@/v2/hooks/useChores'
import { LoadError, LoadingCards } from '@/v2/components/States'
import { ErrorPanel, Skeleton } from '@/v2/parent/states'
import { toastFail } from '@/v2/notify'
import { Photo } from './ChatPhoto'
import { EditBox, MessageActions } from './MessageActions'
import { ReactionChips } from './Reactions'
import { DaySep, ParentBubble, dayName } from './ParentBubble'
import { ThreadHead } from './ThreadHead'
import { ThreadSidePanel } from './ThreadSidePanel'
import { MentionMenu, useComposerBox } from './MentionMenu'
import { QuickReplies } from './QuickReplies'
import { TypingLine } from './TypingLine'
import { renderMentions } from './mentions'
import type { ChatReply } from './dock'

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

function Bubble({ m, mine, names }: { m: ChatMessage; mine: boolean; names: string[] }) {
  const [editing, setEditing] = useState(false)
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
        <MessageActions m={m} mine={mine} kid onEdit={() => setEditing(true)}>
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
          {m.step_title && (
            <span style={{ display: 'block', fontSize: '0.85rem', opacity: 0.75 }}>↪ {m.step_title}</span>
          )}
          {m.note_label && <strong style={{ display: 'block' }}>Note: {m.note_label}</strong>}
          {m.photo_url && <Photo url={m.photo_url} />}
          {editing ? <EditBox m={m} kid onDone={() => setEditing(false)} /> : m.body && renderMentions(m.body, names)}
        </div>
        </MessageActions>
      </div>
      <ReactionChips m={m} kid mine={mine} />
      <span style={{ fontSize: '0.85rem', color: 'var(--p-sub)', alignSelf: mine ? 'flex-end' : 'flex-start' }}>
        {timeLabel(m.created_at)}
        {m.edited_at && (
          <>
            {' · '}
            <span>edited</span>
          </>
        )}
      </span>
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
  reply: replyIn,
}: {
  kind: ThreadKind
  refId: string
  meId: number | null
  kid?: boolean
  bare?: boolean
  /** start the composer answering this step/photo; the parent remounts (key) for a new one */
  reply?: ChatReply
}) {
  const thread = useThread(kind, refId, kid)
  const post = usePost(kid)
  const upload = useUploadChatPhoto(kid)
  const list = useThreads(kid).data
  const gifsOn = !!list?.gifs_enabled
  const [gifOpen, setGifOpen] = useState(false)
  const markRead = useMarkRead(kid)
  const [older, setOlder] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState<boolean | null>(null)
  const [text, setText] = useState('')
  const [photoId, setPhotoId] = useState<number | null>(null)
  const [reply, setReply] = useState<ChatReply | undefined>(replyIn)
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const wideLay = useMediaQuery('(min-width: 1250px)')

  const data = thread.data
  const runDetail = useRunDetail(kind === 'chore' && !kid ? Number(refId) : null) // parent-only route
  const latest = data?.messages ?? []
  const lastId = latest.length ? latest[latest.length - 1].id : 0
  // the last bubble growing a chip row would otherwise push it below the fold
  const lastChips = !!latest[latest.length - 1]?.reactions?.length
  const nearBottom = useRef(true)
  const messages = [...older.filter((o) => !latest.some((l) => l.id === o.id)), ...latest]

  // opening (and every new message while open) marks the thread read
  const { mutate } = markRead
  useEffect(() => {
    if (data?.id) mutate(data.id)
  }, [data?.id, lastId, mutate])
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [lastId])
  useEffect(() => {
    if (lastChips && nearBottom.current) endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [lastChips])
  const onScroll = (e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }
  // "Load earlier" pages live outside the query cache: patch them when a message changes
  useEffect(
    () => onMessageChanged((id, m) => setOlder((o) => (m ? o.map((x) => (x.id === id ? m : x)) : o.filter((x) => x.id !== id)))),
    [],
  )

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
  const once = useSingleFlight()
  const send = () =>
    once(async () => {
      if (!canSend || !data) return
      try {
        // a photo reply (no step) can't link the chore proof photo, so the reference rides in the text
        const body = reply?.label === 'Photo' && !reply.step_id ? `↪ Photo: ${text.trim()}` : text.trim()
        await post.mutateAsync({ threadId: data.id, body, photoId: photoId ?? undefined, stepId: reply?.step_id })
        setText('')
        setPhotoId(null)
        setReply(undefined)
      } catch (e) {
        toastFail(e)
      }
    })
  const sendGif = async (id: number) => {
    if (!data) return
    await post.mutateAsync({ threadId: data.id, body: text.trim(), photoId: id })
    setText('')
  }
  const box = useComposerBox({ text, setText, send, members: data?.members, meId, threadId: data?.id ?? null, kid })
  const names = (data?.members ?? []).map((x) => x.name)
  const typing = data?.typing?.length ? <TypingLine names={data.typing} /> : null
  const at = <MentionMenu {...box.menu} />
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
          {data && !bare && <ThreadHead kind={kind} title={data.title} run={run} glyph={list?.threads.find((t) => t.id === data.id)?.glyph} />}
          {thread.isError && !data && <ErrorPanel kind="unreachable" error={thread.error} onRetry={() => thread.refetch()} />}
          {thread.isError && data && <p className="pc-empty" role="alert">Can&apos;t reach your home box. Showing what we have.</p>}
          {thread.isPending && !thread.isError && <Skeleton rows={3} />}
          <div className="pc-msgs" data-chat-scroll onScroll={onScroll}>
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
                  <ParentBubble m={m} mine={m.author_id !== null && m.author_id === meId} names={names} />
                </Fragment>
              )
            })}
            {typing}
            <div ref={endRef} />
          </div>
          {kind === 'chore' && data && <QuickReplies threadId={data.id} run={run} onFill={box.fill} />}
          <form
            className="pc-reply"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            {reply && (
              <span className="pc-q" data-testid="replying" title={`Replying to ${reply.label}`}>
                <Icon name="subdirectory_arrow_right" size={14} />
                <span>
                  <VisuallyHidden component="span">Replying to </VisuallyHidden>
                  {reply.label}
                </span>
                <button type="button" aria-label="Stop replying" title="Stop replying" onClick={() => setReply(undefined)}>
                  <Icon name="close" size={14} />
                </button>
              </span>
            )}
            {at}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden aria-label="Photo file" onChange={(e) => pick(e.target.files?.[0])} />
            <button type="button" className="pc-ib" data-on={!!photoId} aria-label={photoId ? 'Photo added' : 'Add photo'} title={photoId ? 'Photo added' : 'Add photo'} disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
              <Icon name={photoId ? 'image' : 'add_photo_alternate'} size={20} />
            </button>
            {gifsOn && (
              <button type="button" className="pc-ib" aria-label="Add GIF" title="Add GIF" onClick={() => setGifOpen(true)}>
                <Icon name="gif_box" size={20} />
              </button>
            )}
            <button type="button" className="pc-ib" aria-label="Mention someone" title="Mention someone" disabled={!data} onClick={box.mention}>
              <Icon name="alternate_email" size={20} />
            </button>
            <textarea
              ref={box.box}
              aria-label="Message"
              value={text}
              rows={1}
              maxLength={2000}
              placeholder={reply ? 'Reply…' : 'Message…'}
              onChange={box.onChange}
              onKeyDown={box.onKeyDown}
            />
            <button type="submit" className="pc-send" aria-label="Send" title="Send" aria-busy={post.isPending} disabled={!canSend}>
              <Icon name={post.isPending ? "progress_activity" : "send"} size={16} className={post.isPending ? "pc-spin" : undefined} />
            </button>
          </form>
          {gifsOn && data && (
            <GifPicker threadId={data.id} kid={kid} opened={gifOpen} onClose={() => setGifOpen(false)} onPicked={sendGif} />
          )}
        </section>
        {side && <ThreadSidePanel run={run} kidIds={run ? run.kid_ids : sideKid ? [sideKid] : []} />}
      </div>
    )
  }

  // For kid look, use original layout
  return (
    <section aria-label={data?.title ?? 'Conversation'} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {thread.isError && <LoadError error={thread.error} onRetry={() => thread.refetch()} />}
      {thread.isPending && !thread.isError && <LoadingCards n={3} h={48} />}
      <div data-chat-scroll onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px', minHeight: 240 }}>
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
              <Bubble m={m} mine={m.author_id !== null && m.author_id === meId} names={names} />
            </div>
          )
        })}
        {typing}
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
        {at}
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
        <Button variant="default" aria-label="Mention someone" disabled={!data} onClick={box.mention}>
          <Icon name="alternate_email" size={18} />
        </Button>
        <textarea
          ref={box.box}
          aria-label="Message"
          value={text}
          rows={1}
          maxLength={2000}
          placeholder="Write a message"
          onChange={box.onChange}
          onKeyDown={box.onKeyDown}
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
