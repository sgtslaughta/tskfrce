import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMediaQuery } from '@mantine/hooks'

export type Section = 'chores' | 'kids' | 'rewards' | 'badges'
export interface SectionDef<S extends string = string> {
  id: S
  label: string
  count?: number
}

export const SECTIONS: SectionDef<Section>[] = [
  { id: 'chores', label: 'Chores' },
  { id: 'kids', label: 'Kids' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'badges', label: 'Badges' },
]

interface Props<S extends string = Section> {
  section: S
  counts: Partial<Record<S, number>>
  list: ReactNode
  detail: ReactNode
  listTitle: ReactNode
  path?: string
  sections?: SectionDef<S>[]
}

/**
 * Section tabs with integrated list-detail layout.
 * Tabs at the top switch between sections.
 * Desktop: list column + detail column with grid background.
 * Phone: list only until an item is selected.
 */
export function SectionTabs<S extends string = Section>({
  section,
  counts,
  list,
  detail,
  listTitle,
  path = '/kids',
  sections = SECTIONS as unknown as SectionDef<S>[],
}: Props<S>) {
  const router = useRouter()
  const small = useMediaQuery('(max-width: 767px)')
  const selectedItem = router.query.item

  // Build tab links
  const tabs = sections.map((s) => ({
    ...s,
    href: `${path}?section=${s.id}`,
    active: section === s.id,
  }))

  const handleTabChange = (sectionId: S) => {
    router.replace({ pathname: path, query: { section: sectionId } })
  }

  // Phone: show list only until item is selected
  if (small && selectedItem) {
    return (
      <div className="p-detail-only">
        <Link href={router.pathname} className="p-back-link">
          ← {listTitle}
        </Link>
        <div className="p-detail-panel">{detail}</div>
      </div>
    )
  }

  if (small) {
    return (
      <div>
        <div className="s-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`s-tab ${tab.active ? 's-tab-active' : ''}`}
              onClick={() => handleTabChange(tab.id as S)}
              aria-current={tab.active ? 'page' : undefined}
            >
              {tab.label}
              {tab.count !== undefined && <span className="s-count">{tab.count}</span>}
            </button>
          ))}
        </div>
        <div className="p-list-only">{list}</div>
      </div>
    )
  }

  // Desktop: tabs above, list + detail side-by-side
  return (
    <div>
      <div className="s-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`s-tab ${tab.active ? 's-tab-active' : ''}`}
            onClick={() => handleTabChange(tab.id as S)}
            aria-current={tab.active ? 'page' : undefined}
          >
            {tab.label}
            {tab.count !== undefined && <span className="s-count">{tab.count}</span>}
          </button>
        ))}
      </div>
      <div className="p-list-detail">
        <div className="p-list-column">{list}</div>
        <div className="p-detail-column p-grid">{detail}</div>
      </div>
    </div>
  )
}
