import Link from 'next/link'
import type { TodayKid } from '../types'
import { Icon } from '../parent/Icon'
import { initial } from './KidFacts'

/** Phone Today: one avatar per kid (lavender count = waiting, tick = all done), then Add. */
export function KidStrip({ kids, selected, onSelect }: { kids: TodayKid[]; selected?: number; onSelect: (k: TodayKid) => void }) {
  return (
    <nav className="pt-strip" aria-label="Kids">
      {kids.map((k) => {
        const waiting = k.needs_you_count ?? 0
        const allDone = !!k.total && k.done === k.total
        return (
          <button key={k.id} className="pt-strip-kid" aria-pressed={k.id === selected} onClick={() => onSelect(k)}>
            <span className="pt-strip-av">
              {initial(k.name)}
              {waiting > 0 && <i data-tone="lav">{waiting}</i>}
              {!waiting && allDone && (
                <i data-tone="acc">
                  <Icon name="check" size={12} />
                </i>
              )}
            </span>
            {k.name}
          </button>
        )
      })}
      <Link href="/kids?section=kids" className="pt-strip-kid">
        <span className="pt-strip-av" data-add>
          <Icon name="add" size={20} />
        </span>
        Add
      </Link>
    </nav>
  )
}
