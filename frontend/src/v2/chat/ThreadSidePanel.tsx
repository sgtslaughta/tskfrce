import { Icon } from '@/v2/parent/Icon'
import { useToday } from '@/v2/hooks/useToday'
import { useAuthImage } from '@/v2/today/PhotoViewer'
import type { RunDetail } from '@/v2/types'
import { proxyPath } from './ChatPhoto'

const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

function PhotoTile({ path }: { path: string }) {
  const src = useAuthImage(path)
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="Chore photo" /> : <span aria-label="Chore photo" />
}

/** Chore thread side panel: steps, run photos, and the kid's day; private threads get just the day. */
export function ThreadSidePanel({ run, kidId }: { run?: RunDetail; kidId: number | null }) {
  const kid = useToday().data?.kids.find((k) => k.id === kidId)
  return (
    <aside className="pc-side" aria-label="Details">
      {run && run.steps.length > 0 && (
        <div className="pc-card">
          <h3>
            <Icon name="checklist" size={18} />
            Steps
          </h3>
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
      {kid && (
        <div className="pc-card">
          <h3>
            <Icon name="person" size={18} />
            {kid.name ?? 'Kid'} today
          </h3>
          <div className="pc-kv">
            <span>Chores</span>
            <span>
              {kid.done ?? 0} / {kid.total ?? 0}
            </span>
          </div>
          <div className="pc-kv">
            <span>Points</span>
            <span>{kid.points ?? 0}</span>
          </div>
        </div>
      )}
    </aside>
  )
}
