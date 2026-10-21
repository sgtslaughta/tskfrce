import type { ReactNode } from 'react'
import Link from 'next/link'
import { SegmentedControl } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useRouter } from 'next/router'

export type Section = 'chores' | 'kids' | 'rewards'
export const SECTIONS: { id: Section; label: string }[] = [
  { id: 'chores', label: 'Chores' },
  { id: 'kids', label: 'Kids' },
  { id: 'rewards', label: 'Rewards' },
]

export interface KidProgress {
  id: number
  name: string
  done: number
  total: number
}

interface Props {
  section: Section
  counts: Partial<Record<Section, number>>
  kids: KidProgress[]
  children: ReactNode
}

/** Sidebar (top menu under 768 px) with sections and a per-kid jump list. Badges stays hidden until it has a section. */
export function ManageLayout({ section, counts, kids, children }: Props) {
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
          {kids.length > 0 && <div className="m-grp">Kids</div>}
          {kids.map((k) => (
            <Link key={k.id} href={`/kids?section=chores&kid=${k.id}`}>
              {k.name}
              <span className="m-n">
                {k.done}/{k.total}
              </span>
            </Link>
          ))}
        </nav>
      )}
      <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>{children}</div>
    </div>
  )
}
