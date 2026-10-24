import { useRouter } from 'next/router'
import { ParentShell } from '@/v2/parent/ParentShell'
import { LoadError, LoadingCards } from '@/v2/components/States'
import { RequireParent } from '@/v2/components/RequireParent'
import { useChoresToday, useLibrary } from '@/v2/hooks/useChores'
import { useKids } from '@/v2/hooks/useKids'
import { ChoresSection, type KidProgress } from './ChoresSection'
import { CustomBadgesPanel } from './CustomBadgesPanel'
import { KidsSection } from './KidsSection'
import { ManageLayout, SECTIONS, type Section } from './ManageLayout'
import { RewardsSection } from './RewardsSection'

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function KidsBody() {
  const { query } = useRouter()
  const kids = useKids()
  const defs = useLibrary().data ?? []
  const today = useChoresToday().data ?? {}
  const want = first(query.section)
  const section: Section = SECTIONS.some((s) => s.id === want) ? (want as Section) : 'chores'
  const list = kids.data ?? []
  const progress: KidProgress[] = list.map((k) => {
    const mine = today[String(k.id)] ?? []
    return {
      id: k.id,
      name: k.full_name ?? k.username,
      done: mine.filter((c) => c.status === 'done').length,
      total: mine.length,
    }
  })
  return (
    <ParentShell title="Kids & chores">
      {kids.isError && <LoadError error={kids.error} onRetry={() => kids.refetch()} />}
      <ManageLayout section={section} counts={{ chores: defs.length, kids: list.length }} title="Kids & chores">
        {kids.isPending && <LoadingCards />}
        {section === 'chores' && !kids.isPending && (
          <ChoresSection key={first(query.kid)} kids={list} chores={defs} progress={progress} initialKid={first(query.kid)} />
        )}
        {section === 'kids' && !kids.isPending && <KidsSection kids={list} initialKid={first(query.kid)} focusPin={first(query.pin) === '1'} />}
        {section === 'rewards' && <RewardsSection />}
        {section === 'badges' && <CustomBadgesPanel />}
      </ManageLayout>
    </ParentShell>
  )
}

export function KidsPage() {
  return (
    <RequireParent>
      <KidsBody />
    </RequireParent>
  )
}
