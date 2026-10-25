import Link from 'next/link'
import { Icon } from '@/v2/parent/Icon'
import { Chip } from '@/v2/parent/Chip'
import { useToday } from '@/v2/hooks/useToday'
import { useAuthImage } from '@/v2/today/PhotoViewer'
import { KidFacts, initial } from '@/v2/today/KidFacts'
import type { RunDetail, TodayKid } from '@/v2/types'
import { proxyPath } from './ChatPhoto'

const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const wall = (hhmm: string) => new Date(`2000-01-01T${hhmm}`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const MODE = { each: 'Each kid', race: 'Race (first one wins)', team: 'Team (points split)' }

const stateChip = (state: string) =>
  state === 'done' ? (
    <Chip tone="acc" icon="check">Approved</Chip>
  ) : state === 'needs_you' ? (
    <Chip tone="lav" icon="hourglass_top">Needs OK</Chip>
  ) : (
    <Chip tone="grey" icon="radio_button_unchecked">To do</Chip>
  )

function PhotoTile({ path }: { path: string }) {
  const src = useAuthImage(path)
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="Chore photo" /> : <span aria-label="Chore photo" />
}

const Kv = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="pc-kv">
    <span>{k}</span>
    <span>{children}</span>
  </div>
)

/** Thin meter (Today's bar style) with an accessible name. */
const Bar = ({ label, value, max }: { label: string; value: number; max: number }) => (
  <div className="pt-bar pc-bar" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
    <i style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} />
  </div>
)

function KidCard({ kid }: { kid: TodayKid }) {
  const online = kid.devices.filter((d) => d.online).length
  const p = kid.progress
  return (
    <div className="pc-card">
      <div className="pc-kid">
        <span className="pc-kid-av" aria-hidden>{kid.avatar || initial(kid.name)}</span>
        <span>
          <b>{kid.name ?? 'Kid'}</b>
          <small>Level {kid.progress?.level ?? 1}{kid.progress?.title ? ` · ${kid.progress.title}` : ''}</small>
        </span>
      </div>
      <Kv k="Chores today">{kid.done ?? 0} / {kid.total ?? 0}</Kv>
      <Bar label={`${kid.name ?? 'Kid'} chores today`} value={kid.done ?? 0} max={kid.total ?? 0} />
      {p && p.next > p.floor && (
        <>
          <Kv k={`To level ${p.level + 1}`}>{p.xp - p.floor} / {p.next - p.floor} XP</Kv>
          <Bar label={`${kid.name ?? 'Kid'} level progress`} value={p.xp - p.floor} max={p.next - p.floor} />
        </>
      )}
      <Kv k="Devices online">{online} / {kid.devices.length}</Kv>
      <KidFacts kid={kid} />
      <div className="pc-links">
        <Link href={`/?item=${kid.id}`} className="p-btn">
          <Icon name="today" size={16} />
          Today
        </Link>
        <Link href={`/kid?as=${kid.id}`} className="p-btn">
          <Icon name="visibility" size={16} />
          View as kid
        </Link>
      </div>
    </div>
  )
}

/** Chat side panel: for a chore, the chore (status, steps, photos) and each kid it's for; private threads get the kid. */
export function ThreadSidePanel({ run, kidIds }: { run?: RunDetail; kidIds: number[] }) {
  const kids = useToday().data?.kids ?? []
  const mine = kids.filter((k) => kidIds.includes(k.id))
  // the Today row carries what the run detail lacks (mode, attempt, note, done time)
  const row = run && mine.flatMap((k) => k.chores).find((c) => c.id === run.id)
  return (
    <aside className="pc-side" aria-label="Details">
      {run && (
        <div className="pc-card">
          <h3>
            <Icon name="assignment" size={18} />
            Chore
          </h3>
          <Kv k="Status">{stateChip(run.state)}</Kv>
          <Kv k="Points">+{run.points}</Kv>
          {run.due_time && <Kv k="Due">{wall(run.due_time)}</Kv>}
          {row?.mode && <Kv k="Type">{MODE[row.mode]}</Kv>}
          {row?.done_at && <Kv k="Done">{clock(row.done_at)}</Kv>}
          {row?.taken_by && <Kv k="Done by">{row.taken_by}</Kv>}
          {(row?.attempt ?? 1) > 1 && <Kv k="Try">{row!.attempt}</Kv>}
          {row?.last_note && <p className="pc-note">Sent back: {row.last_note}</p>}
          <div className="pc-links">
            <Link href={`/?chore=${run.id}`} className="p-btn">
              <Icon name="open_in_new" size={16} />
              Open on Today
            </Link>
          </div>
        </div>
      )}
      {run && run.steps.length > 0 && (
        <div className="pc-card">
          <h3>
            <Icon name="checklist" size={18} />
            Steps · {run.steps.filter((s) => s.done).length} of {run.steps.length}
          </h3>
          <Bar label="Steps done" value={run.steps.filter((s) => s.done).length} max={run.steps.length} />
          {run.steps.map((s) => (
            <div key={s.id} className="pc-kv">
              <span>
                <Icon name={s.done ? 'check_circle' : 'radio_button_unchecked'} size={16} />
                {s.title}
              </span>
              {s.done_at && <span>{clock(s.done_at)}</span>}
            </div>
          ))}
        </div>
      )}
      {run && run.photos.length > 0 && (
        <div className="pc-card">
          <h3>
            <Icon name="photo_library" size={18} />
            Photos
          </h3>
          <div className="pc-pics">
            {run.photos.map((p) => (
              <PhotoTile key={p.id} path={proxyPath(p.thumb_url)} />
            ))}
          </div>
        </div>
      )}
      {mine.map((k) => (
        <KidCard key={k.id} kid={k} />
      ))}
    </aside>
  )
}
