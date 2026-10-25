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
      <div style={{ marginBottom: '12px' }}>
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
                {s.label}
                {counts[s.id] !== undefined && <span className="m-n" style={{ marginLeft: '4px' }}>· {counts[s.id]}</span>}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <div className="m-main">{children}</div>
    </div>
  )
}
