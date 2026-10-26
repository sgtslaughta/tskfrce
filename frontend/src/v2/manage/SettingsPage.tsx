import Link from 'next/link'
import { useMediaQuery } from '@mantine/hooks'
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
import { SettingsList, type SettingsSection } from './SettingsList'
import { KidPushPane } from './KidPushPane'
import { AppearancePane } from './AppearancePane'
import { toastFail, toastOk } from '@/v2/notify'

type S = 'family' | 'screen' | 'hours' | 'notify' | 'look' | 'gifs' | 'parents'
const SETTINGS_SECTIONS: SettingsSection<S>[] = [
  { id: 'family', label: 'Family', description: 'Name, time zone, points rules', icon: 'home' },
  { id: 'screen', label: 'Screen time', description: 'Price and early unlock', icon: 'timer' },
  { id: 'hours', label: 'Hours', description: 'School nights, weekends', icon: 'schedule' },
  { id: 'notify', label: 'Notifications', description: 'Kid phones', icon: 'notifications' },
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
  const small = useMediaQuery('(max-width: 767px)')
  const valid = SETTINGS_SECTIONS.some((s) => s.id === want)
  const section: S = valid ? (want as S) : 'family'
  return (
    <ParentShell
      title="Settings"
      list={<SettingsList sections={SETTINGS_SECTIONS} section={small && !valid ? undefined : section} />}
      phone={valid ? <Link href="/settings" className="p-back-link">← Settings</Link> : undefined}
    >
      {family.isError && <ErrorPanel kind="unreachable" error={family.error} onRetry={() => family.refetch()} />}
      <div className="ps-detail">
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
        {section === 'hours' && <HoursSection />}
        {section === 'notify' && <KidPushPane />}
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
      </div>
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
