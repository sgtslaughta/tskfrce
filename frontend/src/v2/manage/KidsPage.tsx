import { Text } from '@mantine/core'
import { useRouter } from 'next/router'
import { FridgeShell } from '@/v2/components/FridgeShell'
import { RequireParent } from '@/v2/components/RequireParent'
import { useChoreDefinitions, useChoresToday } from '@/v2/hooks/useChores'
import { useKids } from '@/v2/hooks/useKids'
import { ChoresSection } from './ChoresSection'
import { CustomBadgesPanel } from './CustomBadgesPanel'
import { KidsSection } from './KidsSection'
import { ManageLayout, SECTIONS, type KidProgress, type Section } from './ManageLayout'
import { RewardsSection } from './RewardsSection'

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function KidsBody() {
  const { query } = useRouter()
  const kids = useKids()
  const defs = useChoreDefinitions().data ?? []
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
    <FridgeShell title="Kids & chores">
      {kids.isError && <Text role="alert">{kids.error.message}</Text>}
      <ManageLayout section={section} counts={{ chores: defs.length, kids: list.length }} kids={progress}>
        {section === 'chores' && (
          <ChoresSection key={first(query.kid)} kids={list} chores={defs} progress={progress} initialKid={first(query.kid)} />
        )}
        {section === 'kids' && <KidsSection kids={list} />}
        {section === 'rewards' && <RewardsSection />}
        {section === 'badges' && <CustomBadgesPanel />}
      </ManageLayout>
    </FridgeShell>
  )
}

export function KidsPage() {
  return (
    <RequireParent>
      <KidsBody />
    </RequireParent>
  )
}
