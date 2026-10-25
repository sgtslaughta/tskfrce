import { Button, Checkbox } from '@mantine/core'
import { IconMessage } from '@tabler/icons-react'
import { ChoreChip } from '../components/ChoreChip'
import { useUploadPhoto } from '../hooks/useKid'
import { statusChip } from '../today/statusChip'
import { KidSteps } from './KidSteps'
import { TellParent } from './TellParent'
import type { KidChore } from '../types'

// parent chip tones -> kid pill tones
const TONE = { acc: 'done', lav: 'wait', amb: 'wait', red: 'late', grey: 'mute' } as const

function Photo({ c }: { c: KidChore }) {
  const up = useUploadPhoto()
  const n = c.photo_count_current ?? 0
  return (
    <div style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <Button component="label" variant="default" size="md" loading={up.isPending} style={{ minHeight: 44 }}>
        {n ? 'Add another photo' : 'Add photo'}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Add photo"
          hidden
          onChange={(e) => {
            const file = e.currentTarget.files?.[0]
            e.currentTarget.value = ''
            if (file) up.mutate({ chore: c.id, file })
          }}
        />
      </Button>
      <span style={{ fontWeight: 700 }}>{n ? `${n} photo${n > 1 ? 's' : ''} added` : 'Photo needed'}</span>
    </div>
  )
}

/** What is still missing before a chore can be marked done. */
function why(c: KidChore) {
  const steps = (c.subtasks ?? []).some((s) => !s.done)
  const photo = !!c.needs_photo && !(c.photo_count_current ?? 0)
  if (photo && steps) return 'Do the steps and add a photo first'
  return photo ? 'Add a photo first' : 'Tick every step first'
}

/** Chore rows for the locked screen. `onDone` omitted = read-only. */
export function KidChecklist({
  chores,
  onDone,
  busyId,
  unread,
  onChat,
}: {
  chores: KidChore[]
  onDone?: (id: number) => void
  busyId?: number | null
  /** unread chat count per chore id; with `onChat`, each chore gets a chat icon button */
  unread?: Record<number, number>
  onChat?: (id: number) => void
}) {
  if (!chores.length)
    return <p style={{ margin: 0, fontSize: 18 }}>No chores today. Enjoy the free time.</p>
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 14 }}>
      {chores.map((c) => {
        const open = c.state === 'todo' && !c.taken_by
        const ready =
          (c.subtasks ?? []).every((s) => s.done) && (!c.needs_photo || (c.photo_count_current ?? 0) > 0)
        return (
          <li
            key={c.id}
            style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minHeight: 56 }}
          >
            <ChoreChip state={c.state} />
            <span className="f-display" style={{ flex: '1 1 140px', minWidth: 0, overflowWrap: 'anywhere', fontSize: 22, fontWeight: 600 }}>
              {c.title}
              {c.mode === 'team' && (
                <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 800, color: 'var(--f-sub)' }}>Team</span>
              )}
            </span>
            <span style={{ fontWeight: 800, color: 'var(--f-sub)' }}>+{c.points}</span>
            {c.taken_by ? (
              <span className="f-pill" data-tone="mute">{`Taken by ${c.taken_by}`}</span>
            ) : (
              <>
                {c.state === 'needs_you' && (
                  <span className="f-pill" data-tone="wait">Waiting for Mom or Dad</span>
                )}
                {c.state === 'todo' &&
                  statusChip(c, Date.now())
                    .slice(0, 1)
                    .filter((x) => x.label !== 'To do' && !(x.label === 'Sent back' && c.last_note))
                    .map((x) => (
                      <span key={x.label} className="f-pill" data-tone={TONE[x.tone as keyof typeof TONE] ?? 'mute'}>{x.label}</span>
                    ))}
                {c.state === 'done' && <span className="f-pill" data-tone="done">Done</span>}
              </>
            )}
            {onChat && (
              <button
                type="button"
                className="f-iconbtn"
                aria-label={`Chat about ${c.title}${unread?.[c.id] ? `, ${unread[c.id]} unread` : ''}`}
                onClick={() => onChat(c.id)}
              >
                <IconMessage size={22} aria-hidden />
                {!!unread?.[c.id] && <span className="f-iconbtn-dot" aria-hidden="true" />}
              </button>
            )}
            {c.last_note && open && (
              <div
                style={{
                  flexBasis: '100%',
                  padding: '8px 12px',
                  borderRadius: 12,
                  fontWeight: 700,
                  background: 'color-mix(in srgb, var(--f-coral, #ff6b57) 18%, transparent)',
                }}
              >
                Sent back: {c.last_note}
                {onChat && (
                  <Button variant="subtle" size="compact-md" ml="xs" onClick={() => onChat(c.id)}>
                    See the chat
                  </Button>
                )}
              </div>
            )}
            {c.deductions?.map((d, i) => (
              <div key={i} style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', borderRadius: 12, fontWeight: 700, background: 'color-mix(in srgb, var(--f-coral, #ff6b57) 18%, transparent)' }}>
                <span style={{ flex: '1 1 160px' }}>
                  {`${d.by_name ?? 'A parent'} took ${d.amount} points`}
                  {d.note && <span style={{ display: 'block', fontWeight: 600 }}>{d.note}</span>}
                </span>
                {onChat && <Button variant="default" size="compact-md" onClick={() => onChat(c.id)}>Reply</Button>}
              </div>
            ))}
            {open && !!c.notes?.length && <TellParent c={c} />}
            {open && onDone && !!c.subtasks?.length && <KidSteps c={c} />}
            {open && onDone && c.needs_photo && <Photo c={c} />}
            {open && onDone && (
              <div style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Button size="lg" disabled={!ready} loading={busyId === c.id} onClick={() => onDone(c.id)} aria-describedby={ready ? undefined : `why-${c.id}`}>
                  Mark done
                </Button>
                {!ready && (
                  <span id={`why-${c.id}`} style={{ fontWeight: 700, color: 'var(--f-sub)' }}>
                    {why(c)}
                  </span>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
