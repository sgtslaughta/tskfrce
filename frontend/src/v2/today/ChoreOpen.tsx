import { useRef, useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { Drawer, Tooltip } from '@mantine/core'
import type { TodayKid, TodayChore } from '../types'
import { useRunDetail } from '../hooks/useChores'
import { useApproveChore, useSendBack } from '../hooks/useToday'
import { useDeduct } from '../hooks/useKids'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { Icon } from '../parent/Icon'
import { errorText } from '../errorText'
import { toastFail, toastOk, withUndo } from '../notify'
import { ThreadView } from '../chat/ThreadView'
import { useAuthImage } from './PhotoViewer'
import { useClock } from './useClock'

const AMOUNTS = [5, 10, 20]

function AuthImg({ path, alt }: { path: string; alt: string }) {
  const src = useAuthImage(path)
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} /> : <span className="pt-photo-ph" aria-label={alt} />
}

/** Open chore: steps, photos and actions on the left; the chore's chat on the right when open. */
export function ChoreOpen({ chore, kid }: { chore: TodayChore; kid: TodayKid }) {
  const { data: run, isError, error, refetch } = useRunDetail(chore.id)
  const approve = useApproveChore()
  const sendBack = useSendBack()
  const deduct = useDeduct()
  const clock = useClock()
  const meId = Number(useUnifiedAuth().user?.id) || null
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [chat, setChat] = useState(false)
  const [ded, setDed] = useState(false)
  const [amount, setAmount] = useState<number | null>(10)
  const [custom, setCustom] = useState('')
  const [why, setWhy] = useState('')
  const [back, setBack] = useState(false)
  const [note, setNote] = useState('')
  const [approving, setApproving] = useState(false)
  const sending = useRef(false) // synchronous guard: a double click or Enter-mash fires before React re-renders

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
  if (!run) return null
  const name = kid.name ?? 'your kid'
  const take = amount ?? Number(custom)
  const thread = <ThreadView kind="chore" refId={String(chore.id)} meId={meId} bare />

  return (
    <div className="pt-open" data-chat={chat && !isMobile}>
      <div className="pt-open-main">
        {run.steps.length > 0 && (
          <ol className="pt-steps">
            {run.steps.map((s) => (
              <li key={s.id} className="pt-step" data-done={s.done}>
                <span className="pt-ck" data-on={s.done} aria-hidden>
                  {s.done && <Icon name="check" size={14} />}
                </span>
                <span className="pt-t">
                  <span className="pt-title">{s.title}</span>
                  {s.done && s.done_at && <small>Done {clock(s.done_at)}</small>}
                </span>
                <Tooltip label={`Reply on ${s.title}`} openDelay={400}>
                  <button className="pt-rp" aria-label={`Reply on ${s.title}`} onClick={() => setChat(true)}>
                    <Icon name="chat_bubble" size={16} />
                  </button>
                </Tooltip>
              </li>
            ))}
          </ol>
        )}

        {run.photos.length > 0 && (
          <div className="pt-photos">
            {run.photos.map((p) => (
              <AuthImg key={p.id} path={p.thumb_url} alt={`Photo for ${chore.title}`} />
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
          <button className="p-btn" data-variant="red" aria-expanded={ded} onClick={() => setDed(!ded)}>
            <Icon name="remove_circle" size={17} />
            Deduct points
          </button>
          <button className="p-btn" aria-expanded={chat} onClick={() => setChat(!chat)}>
            <Icon name="chat" size={17} />
            {chat ? 'Hide chat' : 'Open chat'}
          </button>
        </div>

        {back && (
          <form
            className="pt-ded"
            data-tone="ink"
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

        {ded && (
          <form
            className="pt-ded"
            onSubmit={(e) => {
              e.preventDefault()
              if (sending.current || !(take > 0) || !why.trim()) return
              sending.current = true
              deduct.mutate(
                { id: kid.id, amount: take, note: why.trim() },
                {
                  onSuccess: () => (setDed(false), setWhy(''), setCustom(''), setAmount(10), toastOk(`Deducted ${take} from ${name}`)),
                  onSettled: () => (sending.current = false),
                },
              )
            }}
          >
            <b>Deduct for {chore.title}</b>
            {AMOUNTS.map((a) => (
              <button type="button" key={a} className="pt-amt" data-on={amount === a} onClick={() => setAmount(a)}>
                −{a}
              </button>
            ))}
            <input
              className="pt-amt-custom"
              inputMode="numeric"
              placeholder="Custom"
              aria-label="Custom amount"
              value={custom}
              onFocus={() => setAmount(null)}
              onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
            />
            <input
              placeholder={`Why? (${name} will see this)`}
              aria-label="Reason"
              value={why}
              maxLength={100}
              onChange={(e) => setWhy(e.target.value)}
            />
            <button className="p-btn" data-variant="red" disabled={!why.trim() || !(take > 0) || deduct.isPending} data-loading={deduct.isPending}>
              Deduct
            </button>
          </form>
        )}
      </div>

      {isMobile ? (
        <Drawer opened={chat} onClose={() => setChat(false)} position="bottom" size="58%" title={chore.title} classNames={{ body: 'pt-sheet-body' }}>
          {thread}
        </Drawer>
      ) : (
        chat && (
          <div className="pt-chat" data-testid="chat-column">
            <div className="pt-chat-head">
              <Icon name="subdirectory_arrow_right" size={16} />
              <span className="pt-chat-title">{chore.title}</span>
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
    </div>
  )
}
