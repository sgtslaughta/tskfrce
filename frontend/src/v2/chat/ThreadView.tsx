import { Fragment, useEffect, useRef, useState } from 'react'
import { Button, VisuallyHidden } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
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
import { ErrorPanel, Skeleton } from '@/v2/parent/states'
import { toastFail } from '@/v2/notify'
import { groupProofPhotos } from './groupPhotos'
import { DaySep, ParentBubble, dayName } from './ParentBubble'
import { ThreadHead } from './ThreadHead'
import { ThreadSidePanel } from './ThreadSidePanel'
import { MentionMenu, useComposerBox } from './MentionMenu'
import { QuickReplies } from './QuickReplies'
import { shownTitle } from './ThreadList'
import { TypingLine } from './TypingLine'
import type { ChatReply } from './dock'

/** One conversation: messages (newest at the bottom), "Load earlier", and a composer. */
export function ThreadView({
  kind,
  refId,
  meId,
  kid = false,
  bare = false,
  focus = false,
  reply: replyIn,
  onReplySent,
}: {
  kind: ThreadKind
  refId: string
  meId: number | null
  kid?: boolean
  bare?: boolean
  /** focus the composer on mount */
  focus?: boolean
  /** start the composer answering this step/photo; the parent remounts (key) for a new one */
  reply?: ChatReply
  /** the composer's reply target was sent (or dropped) */
  onReplySent?: () => void
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
        await post.mutateAsync({
          threadId: data.id,
          body: text.trim(),
          photoId: photoId ?? undefined,
          stepId: reply?.step_id,
          proofPhotoId: reply?.proof_photo_id,
        })
        setText('')
        setPhotoId(null)
        setReply(undefined)
        onReplySent?.()
      } catch (e) {
        toastFail(e)
      }
    })
  const sendGif = async (id: number) => {
    if (!data) return
    try {
      await post.mutateAsync({ threadId: data.id, body: text.trim(), photoId: id })
      setText('')
    } catch (e) {
      toastFail(e)
    }
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

  // header, messages, composer, side panel
  const run = kind === 'chore' ? runDetail.data : undefined
  const photoN = run && reply?.proof_photo_id ? run.photos.findIndex((p) => p.id === reply.proof_photo_id) + 1 : 0
  const replyLabel = photoN ? `Photo ${photoN}` : reply?.label
  const labelPending = kind === 'chore' && !!reply?.proof_photo_id && runDetail.isPending // photo number unknown until the run loads
  const sideKid = kind === 'private' ? Number(refId) : (run?.kid_ids[0] ?? null)
  const side = wideLay && !bare && ((kind === 'chore' && !!run) || kind === 'private')
  return (
    <div className="pc-grid" data-side={side} data-bare={bare}>
      <section className="pc-thread" aria-label={data ? shownTitle({ kind, title: data.title }, kid) : 'Conversation'}>
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
          {groupProofPhotos(messages).map(({ m, more }) => {
            const d = dayName(m.created_at)
            const sep = d !== day
            day = d
            return (
              <Fragment key={m.id}>
                {sep && <DaySep label={d} />}
                <ParentBubble m={m} more={more} mine={m.author_id !== null && m.author_id === meId} names={names} kid={kid} kidName={kid ? 'You' : (data?.who ?? undefined)} />
              </Fragment>
            )
          })}
          {typing}
          <div ref={endRef} />
        </div>
        {kind === 'chore' && !kid && data && <QuickReplies threadId={data.id} run={run} onFill={box.fill} />}
        <form
          className="pc-reply"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          {reply && (
            <span className="pc-q" data-testid="replying" title={labelPending ? 'Replying' : `Replying to ${replyLabel}`}>
              <Icon name="subdirectory_arrow_right" size={14} />
              <span>
                <VisuallyHidden component="span">Replying to </VisuallyHidden>
                {labelPending ? <i className="pc-q-sk" data-testid="reply-sk" aria-label="Loading" /> : replyLabel}
              </span>
              <button type="button" aria-label="Stop replying" title="Stop replying" onClick={() => {
                setReply(undefined)
                onReplySent?.()
              }}>
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
            autoFocus={!!replyIn || focus} // a "Reply on photo" request lands in the composer
            aria-label="Message"
            value={text}
            rows={1}
            maxLength={2000}
            placeholder={reply ? 'Reply…' : kid ? 'Write a message' : 'Message…'}
            onChange={box.onChange}
            onKeyDown={box.onKeyDown}
            onSelect={box.onSelect}
            onBlur={box.onBlur}
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
