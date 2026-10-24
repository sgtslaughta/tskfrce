import type { ReactNode } from 'react'
import Link from 'next/link'
import { SegmentedControl } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useRouter } from 'next/router'

export type Section = 'chores' | 'kids' | 'rewards' | 'badges'
export interface SectionDef<S extends string = string> {
  id: S
  label: string
  description?: string
  icon?: string
}
export const SECTIONS: SectionDef<Section>[] = [
  { id: 'chores', label: 'Chores' },
  { id: 'kids', label: 'Kids' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'badges', label: 'Badges' },
]

interface Props<S extends string> {
  section: S
  counts: Partial<Record<S, number>>
  children: ReactNode
  /** Page path the sections live on (default the Kids page). */
  path?: string
  sections?: SectionDef<S>[]
}

/** Sidebar (top menu under 768 px) with the sections. */
export function ManageLayout<S extends string = Section>({
  section,
  counts,
  children,
  path = '/kids',
  sections = SECTIONS as unknown as SectionDef<S>[],
}: Props<S>) {
  const small = useMediaQuery('(max-width: 767px)')
  const router = useRouter()
  return (
    <div className="m-wrap">
      {small ? (
        <SegmentedControl
          fullWidth
          data-scroll={sections.length > 4 ? '' : undefined}
          aria-label="Section"
          data={sections.map((s) => ({ value: s.id, label: s.label }))}
          value={section}
          onChange={(v) => router.replace({ pathname: path, query: { section: v } })}
        />
      ) : (
        <nav className="m-side" aria-label="Sections">
          {sections.map((s) => (
            <Link key={s.id} href={`${path}?section=${s.id}`} aria-current={section === s.id ? 'page' : undefined} className="m-link">
              {s.icon && (
                <div style={{ width: '36px', height: '36px', borderRadius: '12px', border: '1px solid var(--p-line)', background: 'var(--p-card)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <span className="ms" style={{ fontSize: '20px' }}>{s.icon}</span>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14.5px' }}>{s.label}</div>
                {s.description && <div className="m-meta">{s.description}</div>}
              </div>
              {counts[s.id] !== undefined && <span className="m-n" style={{ flexShrink: 0 }}>{counts[s.id]}</span>}
            </Link>
          ))}
        </nav>
      )}
      <div className="m-main">{children}</div>
    </div>
  )
}
