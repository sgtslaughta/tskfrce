import { useRouter } from 'next/router'
import { ParentShell } from '@/v2/parent/ParentShell'
import { LoadError, LoadingCards } from '@/v2/components/States'
import { RequireParent } from '@/v2/components/RequireParent'
import { useFamily } from '@/v2/hooks/useFamily'
import { FamilyCard, GifsCard, ScreenTimeCard } from './FamilyCards'
import { HoursSection } from './HoursSection'
import { InviteSection } from './InviteSection'
import { ParentsList } from './ParentsList'
import { ManageLayout, type SectionDef } from './ManageLayout'

type S = 'family' | 'screen' | 'gifs' | 'hours' | 'parents'
const SETTINGS_SECTIONS: SectionDef<S>[] = [
  { id: 'family', label: 'Family' },
  { id: 'screen', label: 'Screen time & bonuses' },
  { id: 'gifs', label: 'GIFs in chat' },
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
    <ParentShell title="Settings">
      {family.isError && <LoadError error={family.error} onRetry={() => family.refetch()} />}
      <ManageLayout path="/settings" sections={SETTINGS_SECTIONS} section={section} counts={{}}>
        {family.isPending && ['family', 'screen', 'gifs'].includes(section) && <LoadingCards />}
        {section === 'family' && family.data && <FamilyCard fam={family.data} />}
        {section === 'screen' && family.data && <ScreenTimeCard fam={family.data} />}
        {section === 'gifs' && family.data && <GifsCard fam={family.data} />}
        {section === 'hours' && <HoursSection />}
        {section === 'parents' && (
          <>
            <ParentsList />
            <InviteSection />
          </>
        )}
      </ManageLayout>
    </ParentShell>
  )
}

export function SettingsPage() {
  return (
    <RequireParent>
      <SettingsBody />
    </RequireParent>
  )
}
