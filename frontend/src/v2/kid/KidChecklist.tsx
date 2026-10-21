import { Button, Checkbox } from '@mantine/core'
import { ChoreChip } from '../components/ChoreChip'
import { useTickSubtask, useUploadPhoto } from '../hooks/useKid'
import type { KidChore } from '../types'

function Steps({ c }: { c: KidChore }) {
  const tick = useTickSubtask()
  return (
    <div style={{ flexBasis: '100%', display: 'grid', gap: 6, paddingLeft: 8 }}>
      {c.subtasks!.map((s) => (
        <Checkbox
          key={s.id}
          size="md"
          label={s.title}
          checked={s.done}
          onChange={(e) => tick.mutate({ chore: c.id, sub: s.id, done: e.currentTarget.checked })}
          styles={{ root: { minHeight: 44, display: 'flex', alignItems: 'center' } }}
        />
      ))}
    </div>
  )
}

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

/** Chore rows for the locked screen. `onDone` omitted = read-only. */
export function KidChecklist({
  chores,
  onDone,
  busyId,
}: {
  chores: KidChore[]
  onDone?: (id: number) => void
  busyId?: number | null
}) {
  if (!chores.length) return <p style={{ margin: 0, fontSize: 18 }}>No chores today.</p>
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
            <span className="f-display" style={{ flex: '1 1 140px', fontSize: 22, fontWeight: 600 }}>
              {c.title}
              {c.mode === 'team' && (
                <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 800, color: 'var(--f-sub)' }}>Team</span>
              )}
            </span>
            <span style={{ fontWeight: 800, color: 'var(--f-sub)' }}>+{c.points}</span>
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
              </div>
            )}
            {open && onDone && !!c.subtasks?.length && <Steps c={c} />}
            {open && onDone && c.needs_photo && <Photo c={c} />}
            {open && onDone && (
              <Button size="lg" disabled={!ready} loading={busyId === c.id} onClick={() => onDone(c.id)}>
                Mark done
              </Button>
            )}
            {c.taken_by ? (
              <span style={{ fontWeight: 700 }}>Taken by {c.taken_by}</span>
            ) : (
              <>
                {c.state === 'needs_you' && <span style={{ fontWeight: 700 }}>Waiting for Mom or Dad</span>}
                {c.state === 'done' && <span style={{ fontWeight: 700 }}>Done</span>}
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}
