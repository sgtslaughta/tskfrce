import { Text } from '@mantine/core'
import { useRouter } from 'next/router'
import { FridgeShell } from '@/v2/components/FridgeShell'
import { RequireParent } from '@/v2/components/RequireParent'
import { useFamily } from '@/v2/hooks/useFamily'
import { FamilyCard, ScreenTimeCard } from './FamilyCards'
import { HoursSection } from './HoursSection'
import { InviteSection } from './InviteSection'
import { ManageLayout, type SectionDef } from './ManageLayout'

type S = 'family' | 'screen' | 'hours' | 'parents'
const SETTINGS_SECTIONS: SectionDef<S>[] = [
  { id: 'family', label: 'Family' },
  { id: 'screen', label: 'Screen time & bonuses' },
  { id: 'hours', label: 'Hours' },
  { id: 'parents', label: 'Parents' },
]

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function SettingsBody() {
  const { query } = useRouter()
  const family = useFamily()
  const want = first(query.section)
  const section: S = SETTINGS_SECTIONS.some((s) => s.id === want) ? (want as S) : 'family'
  return (
    <FridgeShell title="Settings">
      {family.isError && <Text role="alert">{family.error.message}</Text>}
      <ManageLayout path="/settings" sections={SETTINGS_SECTIONS} section={section} counts={{}}>
        {section === 'family' && family.data && <FamilyCard fam={family.data} />}
        {section === 'screen' && family.data && <ScreenTimeCard fam={family.data} />}
        {section === 'hours' && <HoursSection />}
        {section === 'parents' && <InviteSection />}
      </ManageLayout>
    </FridgeShell>
  )
}

export function SettingsPage() {
  return (
    <RequireParent>
      <SettingsBody />
    </RequireParent>
  )
}
