import type { ReactNode } from 'react'
import type { Flair } from '../types'

interface Props {
  name: string
  avatar: string | null
  level: number
  title: string
  flair: Flair
  /** catalog emblem id -> emoji */
  emblems: Record<string, string>
  size?: 'sm' | 'md' | 'lg'
  children?: ReactNode
}

const cls = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/** A kid's identity: avatar ring, name, emblem and title tag, dressed in their equipped flair. */
export function NameCard({ name, avatar, level, title, flair, emblems, size = 'md', children }: Props) {
  const emblem = flair.emblem ? emblems[flair.emblem] : null
  return (
    <div className={cls('flair-card', `flair-card-${size}`, flair.card && `flair-${flair.card}`)}>
      <span className={cls('flair-ring', `flair-ring-${size}`, flair.ring && `flair-${flair.ring}`)} aria-hidden>
        {avatar ?? name.slice(0, 1).toUpperCase()}
      </span>
      <div className="flair-card-body">
        <div className="flair-card-row">
          <span title={name} className={cls('flair-name', 'flair-ellipsis', flair.name && `flair-${flair.name}`)}>
            {name}
          </span>
          {emblem && <span className="flair-emblem" aria-hidden>{emblem}</span>}
          <span className={cls('flair-title', flair.title ? `flair-${flair.title}` : 'flair-title-basic')}>
            {`Lv ${level} · ${title}`}
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
