import type { ReactNode } from 'react'
import { Icon } from '@/v2/parent/Icon'

/** Settings pane heading (mockup 02 `.mh`): 28px title, one-line sub, optional action on the right. */
export function PaneHead({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) {
  return (
    <div className="pn-mh">
      <div>
        <h2>{title}</h2>
        <div className="pn-s">{sub}</div>
      </div>
      {children}
    </div>
  )
}

/** Settings card (mockup 02 `.card`): icon + title row, then the body. */
export function PaneCard({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <section className="pn-card" aria-label={title}>
      <h3 className="pn-h">
        <Icon name={icon} size={18} />
        <span className="pn-name">{title}</span>
      </h3>
      {children}
    </section>
  )
}
