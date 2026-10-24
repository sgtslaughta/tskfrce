import { useRouter } from 'next/router'
import { ParentShell } from '@/v2/parent/ParentShell'
import { LoadError, LoadingCards } from '@/v2/components/States'
import { RequireParent } from '@/v2/components/RequireParent'
import { useFamily, usePatchFamily } from '@/v2/hooks/useFamily'
import { FamilyCard, GifsCard } from './FamilyCards'
import { HoursSection } from './HoursSection'
import { InviteSection } from './InviteSection'
import { ParentsList } from './ParentsList'
import { ManageLayout, type SectionDef } from './ManageLayout'
import { AppearancePane } from './AppearancePane'
import { toastFail, toastOk } from '@/v2/notify'

type S = 'family' | 'hours' | 'look' | 'gifs' | 'parents'
const SETTINGS_SECTIONS: SectionDef<S>[] = [
  { id: 'family', label: 'Family' },
  { id: 'hours', label: 'Hours' },
  { id: 'look', label: 'Appearance' },
  { id: 'gifs', label: 'GIFs' },
  { id: 'parents', label: 'Parents' },
]

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function SettingsBody() {
  const { query } = useRouter()
  const family = useFamily()
  const patch = usePatchFamily()
  const want = first(query.section)
  const section: S = SETTINGS_SECTIONS.some((s) => s.id === want) ? (want as S) : 'family'
  return (
    <ParentShell title="Settings">
      {family.isError && <LoadError error={family.error} onRetry={() => family.refetch()} />}
      <ManageLayout path="/settings" sections={SETTINGS_SECTIONS} section={section} counts={{}}>
        {family.isPending && ['family', 'look', 'gifs'].includes(section) && <LoadingCards />}
        {section === 'family' && family.data && <FamilyCard fam={family.data} />}
        {section === 'look' && family.data && (
          <AppearancePane
            current={family.data}
            onChange={(p) =>
              patch.mutate(p, {
                onError: toastFail,
                onSuccess: () => toastOk('Saved'),
              })
            }
          />
        )}
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
