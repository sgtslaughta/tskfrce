import { useRouter } from 'next/router'
import { ParentShell } from '@/v2/parent/ParentShell'
import { InfoBlock } from '@/v2/components/InfoBlock'
import { ErrorPanel, Skeleton } from '@/v2/parent/states'
import { RequireParent } from '@/v2/components/RequireParent'
import { useFamily, usePatchFamily } from '@/v2/hooks/useFamily'
import { FamilyCard, GifsCard, ScreenTimeCard } from './FamilyCards'
import { HoursSection } from './HoursSection'
import { InviteSection } from './InviteSection'
import { ParentsList } from './ParentsList'
import { ManageLayout, type SectionDef } from './ManageLayout'
import { AppearancePane } from './AppearancePane'
import { toastFail, toastOk } from '@/v2/notify'

type S = 'family' | 'screen' | 'hours' | 'look' | 'gifs' | 'parents'
const SETTINGS_SECTIONS: SectionDef<S>[] = [
  { id: 'family', label: 'Family', description: 'Name, time zone, points rules', icon: 'home' },
  { id: 'screen', label: 'Screen time', description: 'Price, daily cap, early unlock', icon: 'timer' },
  { id: 'hours', label: 'Hours', description: 'School nights, weekends', icon: 'schedule' },
  { id: 'look', label: 'Appearance', description: 'Accent colour, dark mode', icon: 'palette' },
  { id: 'gifs', label: 'GIFs', description: 'Chat GIF search', icon: 'gif_box' },
  { id: 'parents', label: 'Parents', description: 'Invite and manage parents', icon: 'supervisor_account' },
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
      {family.isError && <ErrorPanel kind="unreachable" error={family.error} onRetry={() => family.refetch()} />}
      <ManageLayout path="/settings" sections={SETTINGS_SECTIONS} section={section} counts={{}}>
        {family.isPending && ['family', 'screen', 'look', 'gifs'].includes(section) && <Skeleton />}
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
        {section === 'screen' && (
          <InfoBlock
            icon="timer"
            text="With screen time on, kids can trade points for Wi-Fi time before their chores are done. It never reaches past their allowed hours."
          />
        )}
        {section === 'screen' && family.data && <ScreenTimeCard fam={family.data} />}
        {section === 'gifs' && family.data && <GifsCard fam={family.data} />}
        {section === 'hours' && (
          <InfoBlock
            icon="schedule"
            text="Outside these hours a kid's devices stay off, even with every chore done. Inside them, devices come on once today's chores are approved."
          />
        )}
        {section === 'hours' && <HoursSection />}
        {section === 'parents' && (
          <>
            <InfoBlock
              icon="supervisor_account"
              text="Every parent can approve chores, lock devices and change settings. Invite links last 24 hours; reset links 30 minutes."
            />
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
