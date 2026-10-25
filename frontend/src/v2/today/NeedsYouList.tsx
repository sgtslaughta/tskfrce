import { useState } from 'react'
import type { NeedsItem } from '../types'
import { useApproveChore, useSendBack } from '../hooks/useToday'
import { useDecideRedemption } from '../hooks/useRewards'
import { openChat } from '../chat/dock'
import { Chip } from '../parent/Chip'
import { Icon } from '../parent/Icon'
import { EmptyState } from '../parent/states'
import { toastFail, toastOk } from '../notify'
import { PhotoViewer, useAuthImage } from './PhotoViewer'

const KIND: Record<NeedsItem['type'], { label: string; icon: string; tone: 'lav' | 'red' | 'amb' | 'acc' }> = {
  chore: { label: 'Needs OK', icon: 'hourglass_top', tone: 'lav' },
  redo: { label: 'Redo', icon: 'undo', tone: 'red' },
  screen_time: { label: 'Screen time', icon: 'timer', tone: 'amb' },
  reward: { label: 'Reward', icon: 'redeem', tone: 'amb' },
}
const isChore = (i: NeedsItem) => i.type === 'chore' || i.type === 'redo'
const clock = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '')
const ordinal = (n: number) => (n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)

function Thumb({ item, onOpen }: { item: NeedsItem; onOpen: () => void }) {
  const src = useAuthImage(item.thumb_url)
  return (
    <button type="button" className="p-needs-thumb" aria-label={`Open photo for ${item.title}`} onClick={onOpen}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt="" />}
    </button>
  )
}

/** "Needs you": chores, redos, screen time and reward requests waiting on a parent, all kids. */
export function NeedsYouList({ items }: { items: NeedsItem[] }) {
  const approve = useApproveChore()
  const sendBack = useSendBack()
  const decide = useDecideRedemption()
  const [viewing, setViewing] = useState<NeedsItem | null>(null)
  const [sending, setSending] = useState<number | null>(null)
  const [note, setNote] = useState('')

  if (items.length === 0) {
    return <EmptyState icon="celebration" tone="acc" title="All caught up" body="Nothing needs your OK right now. Nice." />
  }

  const approveOne = (i: NeedsItem) => (isChore(i) ? approve.mutateAsync(i.id) : decide.mutateAsync({ id: i.id, approve: true }))
  const run = (p: Promise<unknown>, ok: string) => p.then(() => toastOk(ok), toastFail)
  const approveAll = async () => {
    let n = 0
    for (const i of items) {
      try {
        await approveOne(i)
        n++
      } catch (e) {
        toastFail(e)
        break
      }
    }
    if (n) toastOk(n === 1 ? 'Approved' : `Approved ${n} items`)
  }
  const submitSendBack = (id: number, text: string) => {
    setSending(null)
    setNote('')
    return run(sendBack.mutateAsync({ id, note: text }), 'Sent back')
  }

  return (
    <section className="p-needs-list" aria-label="Needs you">
      {items.length > 1 && (
        <button type="button" className="p-btn" data-variant="accent" onClick={approveAll}>
          <Icon name="done_all" size={17} />
          Approve all {items.length}
        </button>
      )}
      {items.map((i) => {
        const k = KIND[i.type]
        const chore = isChore(i)
        return (
          <div key={`${i.type}-${i.id}`} className="p-needs-item">
            <div className="p-needs-header">
              {i.thumb_url ? (
                <Thumb item={i} onOpen={() => setViewing(i)} />
              ) : (
                <span className="p-needs-ic">
                  <Icon name={k.icon} size={18} />
                </span>
              )}
              <span className="p-needs-t">
                <b>{i.title}</b>
                <small>
                  {i.kid_name ?? 'A kid'}
                  {chore
                    ? `${i.attempt && i.attempt > 1 ? ` · ${ordinal(i.attempt)} try` : ''}${i.subtasks_total ? ` · ${i.subtasks_done}/${i.subtasks_total} steps` : ''}${i.submitted_at ? ` · ${clock(i.submitted_at)}` : ''}`
                    : ` · ${i.cost} pts · has ${i.kid_balance}`}
                </small>
              </span>
              <Chip tone={k.tone} icon={k.icon}>
                {k.label}
              </Chip>
            </div>
            {sending === i.id && (
              <input
                className="p-needs-note"
                aria-label="Note for sending back"
                placeholder={`What should ${i.kid_name ?? 'they'} fix?`}
                value={note}
                maxLength={500}
                autoFocus
                onChange={(e) => setNote(e.target.value)}
              />
            )}
            <div className="p-needs-actions">
              <button type="button" className="p-btn" data-variant="accent" onClick={() => run(approveOne(i), 'Approved')}>
                <Icon name="check" size={16} />
                Approve
              </button>
              {chore ? (
                sending === i.id ? (
                  <button type="button" className="p-btn" disabled={!note.trim()} onClick={() => submitSendBack(i.id, note.trim())}>
                    <Icon name="undo" size={16} />
                    Send back
                  </button>
                ) : (
                  <button type="button" className="p-btn" onClick={() => (setSending(i.id), setNote(''))}>
                    <Icon name="undo" size={16} />
                    Send back
                  </button>
                )
              ) : (
                <button type="button" className="p-btn" data-variant="red" onClick={() => run(decide.mutateAsync({ id: i.id, approve: false }), 'Declined')}>
                  <Icon name="close" size={16} />
                  Decline
                </button>
              )}
              {chore && (
                <button type="button" className="p-btn" aria-label={`Chat about ${i.title}`} onClick={() => openChat('chore', String(i.id))}>
                  <Icon name="chat" size={16} />
                </button>
              )}
            </div>
          </div>
        )
      })}
      <PhotoViewer
        item={viewing}
        onClose={() => setViewing(null)}
        onApprove={(id) => run(approve.mutateAsync(id), 'Approved')}
        onSendBack={submitSendBack}
      />
    </section>
  )
}
