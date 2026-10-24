import { ReactNode, useState } from 'react'
import { useRouter } from 'next/router'
import { Tabs } from '@mantine/core'
import { useToday } from '../hooks/useToday'
import type { TodayKid, NeedsItem } from '../types'
import { NeedsYouList } from './NeedsYouList'
import { Chip } from '../parent/Chip'
import { Icon } from '../parent/Icon'
import { ListHeader } from '../parent/ListHeader'

const stateChip = (kid: TodayKid) => {
  if (kid.online_all) return <Chip tone="acc" icon="cloud_done">Online</Chip>
  if ((kid.needs_you_count ?? 0) > 0) return <Chip tone="lav" icon="hourglass_top">Needs OK</Chip>
  if (kid.done === kid.total) return <Chip tone="grey" icon="check_circle">All done</Chip>
  return <Chip tone="grey" icon="lock">Locked</Chip>
}

export function KidList({ onSelectKid, selectedKid }: { onSelectKid: (kid: TodayKid) => void; selectedKid?: TodayKid }) {
  const { data } = useToday()
  const router = useRouter()
  const [tab, setTab] = useState<string | null>('today')
  const needsYouCount = (data?.needs_you?.length ?? 0)

  return (
    <ListHeader title="Kids">
      <div className="p-segment-tabs">
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List>
            <Tabs.Tab value="today">Today</Tabs.Tab>
            <Tabs.Tab value="needs">
              Needs you · {needsYouCount}
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="today">
            <div className="p-kid-cards">
              {(data?.kids ?? []).map((kid) => (
                <button
                  key={kid.id}
                  className="p-kid-card"
                  data-selected={selectedKid?.id === kid.id}
                  onClick={() => {
                    onSelectKid(kid)
                    router.push(`/?item=${kid.id}`, undefined, { shallow: true })
                  }}
                >
                  <div className="p-kid-avatar">{kid.avatar || kid.name?.[0] || '?'}</div>
                  <div className="p-kid-info">
                    <div className="p-kid-name">{kid.name}</div>
                    <div className="p-kid-progress">
                      {kid.done ?? 0} of {kid.total ?? 0} chores
                    </div>
                  </div>
                  <div className="p-kid-status">{stateChip(kid)}</div>
                  {selectedKid?.id === kid.id && kid.progress && (
                    <div className="p-kid-expanded">
                      <div className="p-meter-bar" style={{ width: `${(kid.done ?? 0) / (kid.total ?? 1) * 100}%` }} />
                      <div className="p-kid-facts">
                        <div>
                          <span>Points</span>
                          <b>{kid.progress.points}</b>
                        </div>
                        <div>
                          <span>Streak</span>
                          <b>{kid.progress.streak || 0} days</b>
                        </div>
                        <div>
                          <span>Next reward</span>
                          <b>{kid.progress.next_reward_points} pts</b>
                        </div>
                        <div>
                          <span>Locks at</span>
                          <b>{kid.progress.locked_until || '—'}</b>
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </Tabs.Panel>
          <Tabs.Panel value="needs">
            <NeedsYouList items={data?.needs_you ?? []} />
          </Tabs.Panel>
        </Tabs>
      </div>
    </ListHeader>
  )
}
