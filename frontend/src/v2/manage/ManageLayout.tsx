import type { ReactNode } from 'react'
import Link from 'next/link'
import { SegmentedControl } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useRouter } from 'next/router'

export type Section = 'chores' | 'kids' | 'rewards' | 'badges'
export const SECTIONS: { id: Section; label: string }[] = [
  { id: 'chores', label: 'Chores' },
  { id: 'kids', label: 'Kids' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'badges', label: 'Badges' },
]

interface Props {
  section: Section
  counts: Partial<Record<Section, number>>
  children: ReactNode
}

/** Sidebar (top menu under 768 px) with the sections. */
export function ManageLayout({ section, counts, children }: Props) {
  const small = useMediaQuery('(max-width: 767px)')
  const router = useRouter()
  return (
    <div className="m-wrap">
      {small ? (
        <SegmentedControl
          fullWidth
          aria-label="Section"
          data={SECTIONS.map((s) => ({ value: s.id, label: s.label }))}
          value={section}
          onChange={(v) => router.replace({ pathname: '/kids', query: { section: v } })}
        />
      ) : (
        <nav className="m-side" aria-label="Sections">
          {SECTIONS.map((s) => (
            <Link key={s.id} href={`/kids?section=${s.id}`} aria-current={section === s.id ? 'page' : undefined}>
              {s.label}
              {counts[s.id] !== undefined && <span className="m-n">{counts[s.id]}</span>}
            </Link>
          ))}
        </nav>
      )}
      <div className="m-main">{children}</div>
    </div>
  )
}
