import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Tooltip } from '@mantine/core'
import type { NeedsItem } from '../types'
import { useApproveChore, useSendBack } from '../hooks/useToday'
import { useDecideRedemption } from '../hooks/useRewards'
import { openChat } from '../chat/dock'
import { Chip } from '../parent/Chip'
import { Icon } from '../parent/Icon'
import { EmptyState } from '../parent/states'
import { notifications } from '@mantine/notifications'
import { errorText } from '../errorText'
import { toastFail, toastOk } from '../notify'
import { PhotoViewer, useAuthImage } from './PhotoViewer'
import { useClock } from './useClock'

const KIND: Record<NeedsItem['type'], { label: string; icon: string; tone: 'lav' | 'red' | 'amb' | 'acc' }> = {
  chore: { label: 'Needs OK', icon: 'hourglass_top', tone: 'lav' },
  redo: { label: 'Redo', icon: 'undo', tone: 'red' },
  screen_time: { label: 'Screen time', icon: 'timer', tone: 'amb' },
  reward: { label: 'Reward', icon: 'redeem', tone: 'amb' },
}
const isChore = (i: NeedsItem) => i.type === 'chore' || i.type === 'redo'
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
  const clock = useClock()
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['today'] }) // a failed item may be gone or already handled
  const approve = useApproveChore()
  const sendBack = useSendBack()
  const decide = useDecideRedemption()
  const [viewing, setViewing] = useState<NeedsItem | null>(null)
  const [sending, setSending] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const lock = useRef(false) // synchronous guard: Enter-mashing fires before React re-renders

  if (items.length === 0) {
    return <EmptyState icon="celebration" tone="acc" title="All caught up" body="Nothing needs your OK right now. Nice." />
  }

  const approveOne = (i: NeedsItem) => (isChore(i) ? approve.mutateAsync(i.id) : decide.mutateAsync({ id: i.id, approve: true }))
  const run = (go: () => Promise<unknown>, ok: string, key?: string) => {
    if (lock.current) return Promise.resolve()
    lock.current = true
    setBusy(key ?? 'x')
    return go()
      .then(() => (toastOk(ok), true), (e) => (toastFail(e), refresh(), false))
      .finally(() => ((lock.current = false), setBusy(null)))
  }
  /** Approve every item, one by one; a failure doesn't stop the rest and the toast counts both. */
  const approveAll = async () => {
    if (lock.current) return
    lock.current = true
    setBusy('all')
    let n = 0
    let failed: unknown[] = []
    for (const i of items) {
      try {
        await approveOne(i)
        n++
      } catch (e) {
        failed = [...failed, e]
      }
    }
    lock.current = false
    setBusy(null)
    if (failed.length) refresh()
    if (n) toastOk(n === 1 ? 'Approved' : `Approved ${n} items`)
    if (failed.length) {
      notifications.show({
        title: `${failed.length} ${failed.length === 1 ? 'item' : 'items'} not approved`,
        message: errorText(failed[0]),
        color: 'fridgeRed',
      })
    }
  }
  /** The note box stays open (with its text) if the request fails. */
  const submitSendBack = async (id: number, text: string) => {
    const ok = await run(() => sendBack.mutateAsync({ id, note: text }), 'Sent back', `s${id}`)
    if (ok) (setSending(null), setNote(''))
  }

  return (
    <section className="p-needs-list" aria-label="Needs you">
      {items.length > 1 && (
        <button type="button" className="p-btn" data-variant="accent" disabled={!!busy} data-loading={busy === 'all'} onClick={approveAll}>
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
              <button type="button" className="p-btn" data-variant="accent" disabled={!!busy} data-loading={busy === `a${i.type}${i.id}`} onClick={() => run(() => approveOne(i), 'Approved', `a${i.type}${i.id}`)}>
                <Icon name="check" size={16} />
                Approve
              </button>
              {chore ? (
                sending === i.id ? (
                  <button type="button" className="p-btn" disabled={!note.trim() || !!busy} data-loading={busy === `s${i.id}`} onClick={() => submitSendBack(i.id, note.trim())}>
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
                <button type="button" className="p-btn" data-variant="red" disabled={!!busy} data-loading={busy === `d${i.id}`} onClick={() => run(() => decide.mutateAsync({ id: i.id, approve: false }), 'Declined', `d${i.id}`)}>
                  <Icon name="close" size={16} />
                  Decline
                </button>
              )}
              {chore && (
                <Tooltip label="Open chat" openDelay={400}>
                  <button type="button" className="p-btn" aria-label={`Chat about ${i.title}`} onClick={() => openChat('chore', String(i.id))}>
                    <Icon name="chat" size={16} />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        )
      })}
      <PhotoViewer
        item={viewing}
        onClose={() => setViewing(null)}
        onApprove={(id) => run(() => approve.mutateAsync(id), 'Approved', `p${id}`)}
        onSendBack={submitSendBack}
      />
    </section>
  )
}
