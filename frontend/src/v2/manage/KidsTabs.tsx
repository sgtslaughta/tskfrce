import { useRouter } from 'next/router'
import { ListHeader } from '@/v2/parent/ListHeader'
import { SegmentedControl } from '@/v2/parent/SegmentedControl'

export type Section = 'chores' | 'kids' | 'rewards' | 'badges'
export const SECTIONS: { id: Section; label: string }[] = [
  { id: 'chores', label: 'Chores' },
  { id: 'kids', label: 'Kids' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'badges', label: 'Badges' },
]

/** List column header: page title and the Chores / Kids / Rewards / Badges tabs. */
export function KidsTabs({ section, counts }: { section: Section; counts: Partial<Record<Section, number>> }) {
  const router = useRouter()
  return (
    <ListHeader title="Kids & chores">
      <div className="pk-tabs">
        <SegmentedControl
          label="Section"
          value={section}
          onChange={(s) => router.replace({ pathname: '/kids', query: { section: s } })}
          options={SECTIONS.map((s) => ({
            value: s.id,
            label: counts[s.id] === undefined ? s.label : `${s.label} · ${counts[s.id]}`,
          }))}
        />
      </div>
    </ListHeader>
  )
}
