import type { ReactNode } from 'react'
import { Icon } from './Icon'

/** Collapsible list group (native <details>): starts open when it holds the selection or needs attention. */
export function Fold({ title, icon, count, open, children }: { title: string; icon: string; count: number; open?: boolean; children: ReactNode }) {
  return (
    <details className="p-fold" open={open || undefined}>
      <summary>
        <Icon name={icon} size={18} />
        <span className="p-fold-t">{title}</span>
        <span className="p-fold-n">{count}</span>
        <Icon name="expand_more" size={18} className="p-fold-car" />
      </summary>
      <div className="p-fold-body">{children}</div>
    </details>
  )
}
