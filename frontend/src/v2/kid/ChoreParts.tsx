import { Icon } from '@/v2/parent/Icon'
import { useUploadPhoto } from '../hooks/useKid'
import type { KidChore } from '../types'

/** Every step done, and a photo when the chore needs one. */
export const isReady = (c: KidChore) =>
  (c.subtasks ?? []).every((s) => s.done) && (!c.needs_photo || (c.photo_count_current ?? 0) > 0)

/** What is still missing before a chore can be marked done. */
export function whyNot(c: KidChore) {
  const steps = (c.subtasks ?? []).some((s) => !s.done)
  const photo = !!c.needs_photo && !(c.photo_count_current ?? 0)
  if (photo && steps) return 'Do the steps and add a photo first'
  return photo ? 'Add a photo first' : 'Tick every step first'
}

export function PhotoButton({ c }: { c: KidChore }) {
  const up = useUploadPhoto()
  const n = c.photo_count_current ?? 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <label className="k-tell" aria-busy={up.isPending || undefined}>
        <Icon name="photo_camera" />
        {n ? 'Add another photo' : 'Add photo'}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Add photo"
          hidden
          disabled={up.isPending}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0]
            e.currentTarget.value = ''
            if (file) up.mutate({ chore: c.id, file })
          }}
        />
      </label>
      <span style={{ fontWeight: 700 }}>{n ? `${n} photo${n > 1 ? 's' : ''} added` : 'Photo needed'}</span>
    </div>
  )
}

/** "{by} took {n} points" cards (08 .ded); Reply only when `onReply`. */
export function DeductionCards({ c, onReply }: { c: KidChore; onReply?: () => void }) {
  if (!c.deductions?.length) return null
  return (
    <>
      {c.deductions.map((d, i) => (
        <div key={i} className="k-ded">
          <Icon name="remove_circle" />
          <div>
            <b>{`${d.by_name ?? 'A parent'} took ${d.amount} points`}</b>
            {d.note && <div>{`“${d.note}”`}</div>}
            {onReply && (
              <button type="button" className="k-tell" onClick={onReply}>
                <Icon name="chat" />
                Reply
              </button>
            )}
          </div>
        </div>
      ))}
    </>
  )
}

/** Coral-tint "Sent back: {note}" card with a link to the chat. */
export function SentBackCard({ c, onChat }: { c: KidChore; onChat?: () => void }) {
  if (!c.last_note) return null
  return (
    <div className="k-back-card">
      <span style={{ flex: '1 1 160px' }}>{`Sent back: ${c.last_note}`}</span>
      {onChat && (
        <button type="button" className="k-tell" onClick={onChat}>
          <Icon name="chat" />
          See the chat
        </button>
      )}
    </div>
  )
}

/** Blue pill confirming the kid's note went to a parent. */
export function NoteSent({ c }: { c: KidChore }) {
  if (!c.note) return null
  return (
    <span className="k-note-pill">
      <Icon name="check_circle" />
      {`Note sent: ${c.note.label}`}
    </span>
  )
}
