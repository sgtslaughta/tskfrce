import { useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { Drawer, Tooltip } from '@mantine/core'
import type { TodayKid, TodayChore } from '../types'
import { useRunDetail } from '../hooks/useChores'
import { useApproveChore, useMarkDone, useMarkNotDone, useSendBack } from '../hooks/useToday'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { Icon } from '../parent/Icon'
import { Skeleton } from '../parent/states'
import { errorText } from '../errorText'
import { toastFail, toastOk, withUndo } from '../notify'
import { Chip } from '../parent/Chip'
import { ThreadView } from '../chat/ThreadView'
import { claimChat, openChat, type ChatReply } from '../chat/dock'
import { PhotoViewer, useAuthImage } from './PhotoViewer'
import { MoveSkip } from './ChoreNote'
import { DeductForm } from './DeductForm'
import { useClock, useNow } from './useClock'

function AuthImg({ path, alt }: { path: string; alt: string }) {
  const src = useAuthImage(path)
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} /> : <span className="pt-photo-ph" aria-label={alt} />
}

/** Open chore: steps, photos and actions on the left; the chore's chat on the right when open. */
export function ChoreOpen({ chore, kid }: { chore: TodayChore; kid: TodayKid }) {
  const { data: run, isError, error, refetch } = useRunDetail(chore.id)
  const approve = useApproveChore()
  const markDone = useMarkDone()
  const markNotDone = useMarkNotDone()
  const sendBack = useSendBack()
  const clock = useClock()
  const now = useNow()
  const meId = Number(useUnifiedAuth().user?.id) || null
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [chat, setChat] = useState(false)
  const [reply, setReply] = useState<{ to?: ChatReply; n: number }>({ n: 0 }) // n remounts the composer per reply
  const [ded, setDed] = useState(false)
  const [back, setBack] = useState(false)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<number | null>(null) // index of the enlarged proof photo
  const [approving, setApproving] = useState(false)
  const sending = useRef(false) // synchronous guard: a double click or Enter-mash fires before React re-renders
  // openChat for this chore (Reply buttons, step and photo replies) lands in the column beside it
  useEffect(
    () =>
      claimChat('chore', String(chore.id), (to) => {
        setChat(true)
        setReply((r) => ({ to, n: r.n + 1 }))
      }),
    [chore.id],
  )

  if (!run && isError)
    return (
      <div className="pt-open" role="alert">
        <div className="pt-open-err">
          <span>{errorText(error)}</span>
          <button type="button" className="p-btn" onClick={() => refetch()}>
            <Icon name="refresh" size={16} />
            Try again
          </button>
        </div>
      </div>
    )
  if (!run)
    return (
      <div className="pt-open">
        <Skeleton rows={2} />
      </div>
    )
  const name = kid.name ?? 'your kid'
  const ref = String(chore.id)
  const thread = <ThreadView key={reply.n} kind="chore" refId={ref} meId={meId} bare focus={reply.n > 0} reply={reply.to} onReplySent={() => setReply((r) => ({ ...r, to: undefined }))} />

  return (
    <div className="pt-open" data-chat={chat && !isMobile}>
      <div className="pt-open-main">
        {run.steps.length > 0 && (
          <ol className="pt-steps">
            {run.steps.map((s, i) => {
              // numbered when chained to a neighbour; free steps show a dashed "–" (spec 3.2)
              const chained = (i > 0 && s.after_previous) || !!run.steps[i + 1]?.after_previous
              const late = !s.done && !!s.due_at && Date.parse(s.due_at) < now
              return (
                <li key={s.id} className="pt-step" data-done={s.done}>
                  <span
                    className="pk-num"
                    data-free={!chained}
                    title={s.locked ? 'Locked until the step above is done' : chained ? 'Goes in order' : 'Any time'}
                  >
                    {chained ? i + 1 : '–'}
                  </span>
                  <span className="pt-ck" data-on={s.done} aria-hidden>
                    {s.done && <Icon name="check" size={14} />}
                  </span>
                  <span className="pt-t">
                    <span className="pt-title">{s.title}</span>
                    {s.done && s.done_at && <small>Done {clock(s.done_at)}</small>}
                  </span>
                  {s.locked && <Chip tone="grey" icon="lock">Locked</Chip>}
                  {late ? (
                    <Chip tone="red" icon="alarm">Late</Chip>
                  ) : (
                    !s.done && s.due_at && <Chip tone="grey" icon="schedule">By {clock(s.due_at)}</Chip>
                  )}
                  <Tooltip label={`Reply on ${s.title}`} openDelay={400}>
                    <button
                      type="button"
                      className="pt-rp"
                      aria-label={`Reply on ${s.title}`}
                      onClick={() => openChat('chore', ref, { step_id: s.id, label: s.title })}
                    >
                      <Icon name="chat_bubble" size={16} />
                    </button>
                  </Tooltip>
                </li>
              )
            })}
          </ol>
        )}

        {run.photos.length > 0 && (
          <div className="pt-photos">
            {run.photos.map((p, i) => (
              <span key={p.id} className="pt-photo">
                <button type="button" aria-label={`Open photo ${i + 1}`} onClick={() => setPhoto(i)}>
                  <AuthImg path={p.thumb_url} alt={`Photo for ${chore.title}`} />
                </button>
                <button
                  type="button"
                  className="pt-rp"
                  aria-label="Reply on photo"
                  title="Reply on photo"
                  onClick={() => openChat('chore', ref, { proof_photo_id: p.id, label: `Photo ${i + 1}` })}
                >
                  <Icon name="chat_bubble" size={14} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="pt-acts">
          {chore.state === 'needs_you' && (
            <>
              <button
                className="p-btn"
                data-variant="accent"
                disabled={approving || approve.isPending}
                data-loading={approving || approve.isPending}
                onClick={() => {
                  if (sending.current) return
                  sending.current = true
                  setApproving(true)
                  void withUndo(() => approve.mutateAsync(chore.id), `Approved +${chore.points}`).finally(() => {
                    sending.current = false
                    setApproving(false)
                  })
                }}
              >
                <Icon name="check" size={17} />
                Approve +{chore.points}
              </button>
              <button className="p-btn" aria-expanded={back} onClick={() => setBack(!back)}>
                <Icon name="undo" size={17} />
                Send back
              </button>
            </>
          )}
          {chore.state === 'todo' && chore.mode !== 'race' && (
            <button
              className="p-btn"
              data-variant="accent"
              disabled={markDone.isPending}
              data-loading={markDone.isPending}
              onClick={() => void markDone.mutateAsync(chore.id).then(() => toastOk(`Marked done +${chore.points}`), toastFail)}
            >
              <Icon name="task_alt" size={17} />
              Mark done +{chore.points}
            </button>
          )}
          {chore.state === 'done' && (
            <button
              className="p-btn"
              disabled={markNotDone.isPending}
              data-loading={markNotDone.isPending}
              onClick={() => void markNotDone.mutateAsync(chore.id).then(() => toastOk('Marked not done'), toastFail)}
            >
              <Icon name="remove_done" size={17} />
              Mark not done
            </button>
          )}
          {chore.state === 'skipped' && (
            <button
              className="p-btn"
              disabled={markNotDone.isPending}
              data-loading={markNotDone.isPending}
              onClick={() => void markNotDone.mutateAsync(chore.id).then(() => toastOk('Back on today’s list'), toastFail)}
            >
              <Icon name="undo" size={17} />
              Undo skip
            </button>
          )}
          {chore.state !== 'skipped' && (
            <button className="p-btn" data-variant="red" aria-expanded={ded} onClick={() => setDed(!ded)}>
              <Icon name="remove_circle" size={17} />
              Deduct points
            </button>
          )}
          <button className="p-btn" aria-expanded={chat} onClick={() => (chat ? setChat(false) : openChat('chore', ref))}>
            <Icon name="chat" size={17} />
            {chat ? 'Hide chat' : 'Open chat'}
          </button>
          {chore.state === 'todo' && !chore.note && <MoveSkip chore={chore} />}
        </div>

        {back && (
          <form
            className="pt-ded"
            data-tone="ink"
            onKeyDown={(e) => e.key === 'Escape' && setBack(false)}
            onSubmit={(e) => {
              e.preventDefault()
              if (sending.current || !note.trim()) return
              sending.current = true
              sendBack.mutate(
                { id: chore.id, note: note.trim() },
                {
                  onSuccess: () => (setBack(false), setNote(''), toastOk('Sent back')),
                  onError: toastFail,
                  onSettled: () => (sending.current = false),
                },
              )
            }}
          >
            <b>What should {name} fix?</b>
            <input aria-label="Note for sending back" value={note} maxLength={500} autoFocus onChange={(e) => setNote(e.target.value)} />
            <button className="p-btn" disabled={!note.trim() || sendBack.isPending} data-loading={sendBack.isPending}>
              Send back
            </button>
          </form>
        )}

        {ded && <DeductForm runId={chore.id} title={chore.title} kidIds={run.kid_ids} kidId={kid.id} onDone={() => setDed(false)} />}
      </div>

      {isMobile ? (
        <Drawer
          opened={chat}
          onClose={() => setChat(false)}
          position="bottom"
          size="58%"
          title={
            <>
              {chore.title}
              <small className="pt-sheet-sub">{`Chore · ${kid.name}`}</small>
            </>
          }
          classNames={{ content: 'pt-sheet', body: 'pt-sheet-body' }}
        >
          {thread}
        </Drawer>
      ) : (
        chat && (
          <div className="pt-chat" data-testid="chat-column">
            <div className="pt-chat-head">
              <Icon name="subdirectory_arrow_right" size={16} />
              <span className="pt-chat-title">{reply.to?.label ?? chore.title}</span>
              <Tooltip label="Close chat" openDelay={400}>
                <button aria-label="Close chat" onClick={() => setChat(false)}>
                  <Icon name="close" size={18} />
                </button>
              </Tooltip>
            </div>
            {thread}
          </div>
        )
      )}
      <PhotoViewer
        item={photo === null ? null : { type: 'chore', id: chore.id, kid_id: kid.id, kid_name: kid.name, title: chore.title }}
        photos={run.photos}
        start={photo ?? 0}
        onClose={() => setPhoto(null)}
      />
    </div>
  )
}
