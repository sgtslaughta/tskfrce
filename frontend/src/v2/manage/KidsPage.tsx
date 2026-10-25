import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { ParentShell } from '@/v2/parent/ParentShell'
import { useMediaQuery } from '@mantine/hooks'
import { EmptyState, ErrorPanel, Skeleton } from '@/v2/parent/states'
import { RequireParent } from '@/v2/components/RequireParent'
import { useLibrary } from '@/v2/hooks/useChores'
import { useCustomBadges } from '@/v2/hooks/useCustomBadges'
import { useKids } from '@/v2/hooks/useKids'
import { useRewards } from '@/v2/hooks/useRewards'
import { BadgeDetail } from './BadgeDetail'
import { BadgesList } from './BadgesList'
import { ChoreDetail } from './ChoreDetail'
import { ChoresList } from './ChoresList'
import { KidDetail } from './KidDetail'
import { KidEditor } from './KidEditor'
import { KidsList } from './KidsList'
import { KidsTabs, SECTIONS, type Section } from './KidsTabs'
import { RewardDetail } from './RewardDetail'
import { RewardsList } from './RewardsList'

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function KidsBody() {
  const router = useRouter()
  const { query } = router
  const kids = useKids()
  const chores = useLibrary()
  const rewards = useRewards()
  const badges = useCustomBadges()
  const want = first(query.section)
  const section: Section = SECTIONS.some((s) => s.id === want) ? (want as Section) : 'chores'
  const kidList = kids.data ?? []
  const small = useMediaQuery('(max-width: 767px)')
  // desktop opens the section's first item rather than an empty pane; phone stays on the list
  const firstId = { chores: chores.data, kids: kids.data, rewards: rewards.data, badges: badges.data }[section]?.[0]?.id
  const item = first(query.item) ?? (small || firstId == null || query.kid ? undefined : String(firstId))
  const pick = (id: number | 'new' | null) => {
    const { item: _drop, ...rest } = query
    router.push({ pathname: '/kids', query: id === null ? { section } : { ...rest, section, item: id } }, undefined, { shallow: true })
  }

  // Deep link /kids?section=kids&kid=7&pin=1 selects that kid (phones need ?item to show the detail).
  const kidParam = first(query.kid)
  useEffect(() => {
    if (kidParam && !query.item) router.replace({ pathname: '/kids', query: { section: 'kids', item: kidParam, pin: first(query.pin) } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidParam, query.item])

  const lists = {
    chores: <ChoresList chores={chores.data ?? []} kids={kidList} selected={item} onSelect={pick} />,
    kids: <KidsList kids={kidList} selected={item} onSelect={pick} />,
    rewards: <RewardsList rewards={rewards.data ?? []} selected={item} onSelect={pick} />,
    badges: <BadgesList badges={badges.data ?? []} selected={item} onSelect={pick} />,
  }

  const id = Number(item)
  const chore = chores.data?.find((c) => c.id === id)
  const kid = kidList.find((k) => k.id === id)
  const reward = rewards.data?.find((r) => r.id === id)
  const badge = badges.data?.find((b) => b.id === id)
  const select = (n: number | null) => pick(n)
  const details = {
    chores: item === 'new' ? <ChoreDetail key="new" kids={kidList} onSelect={select} /> : chore && <ChoreDetail key={chore.id} kids={kidList} chore={chore} onSelect={select} />,
    kids:
      item === 'new' ? (
        <div className="pk-detail"><div className="pk-grid"><KidEditor onDone={() => pick(null)} /></div></div>
      ) : (
        kid && <KidDetail key={kid.id} kid={kid} focusPin={first(query.pin) === '1'} onDeleted={() => pick(null)} />
      ),
    rewards: item === 'new' ? <RewardDetail key="new" onSelect={select} /> : reward && <RewardDetail key={reward.id} reward={reward} onSelect={select} />,
    badges: item === 'new' ? <BadgeDetail key="new" kids={kidList} onSelect={select} /> : badge && <BadgeDetail key={badge.id} badge={badge} kids={kidList} onSelect={select} />,
  }

  const noun = { chores: 'chore', kids: 'kid', rewards: 'reward', badges: 'badge' }[section]
  const total = { chores: chores.data?.length, kids: kids.data?.length, rewards: rewards.data?.length, badges: badges.data?.length }[section]
  const EMPTY_ICON = { chores: 'task_alt', kids: 'person_add', rewards: 'redeem', badges: 'military_tech' }
  return (
    <ParentShell
      title="Kids & chores"
      list={
        <>
          <KidsTabs
            section={section}
            counts={{ chores: chores.data?.length, kids: kids.data?.length }}
          />
          {kids.isPending ? <Skeleton /> : lists[section]}
        </>
      }
    >
      {kids.isError && <ErrorPanel kind="unreachable" error={kids.error} onRetry={() => kids.refetch()} />}
      {details[section] ||
        (!kids.isError && total === 0 && (
          <EmptyState
            icon={EMPTY_ICON[section]}
            title={`No ${noun}s yet`}
            body={`Add your first ${noun} to get started.`}
            actions={[{ label: `Add a ${noun}`, icon: 'add', onClick: () => pick('new') }]}
          />
        ))}
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
