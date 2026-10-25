import { useState } from 'react'
import { useRouter } from 'next/router'
import { Tabs } from '@mantine/core'
import { useToday } from '../hooks/useToday'
import type { TodayKid } from '../types'
import { NeedsYouList } from './NeedsYouList'
import { Chip } from '../parent/Chip'
import { ListHeader } from '../parent/ListHeader'

const stateChip = (kid: TodayKid) => {
  if (kid.online_all) return <Chip tone="acc" icon="cloud_done">Online</Chip>
  if ((kid.needs_you_count ?? 0) > 0) return <Chip tone="lav" icon="hourglass_top">Needs OK</Chip>
  if (kid.done === kid.total) return <Chip tone="grey" icon="check_circle">All done</Chip>
  return <Chip tone="grey" icon="lock">Locked</Chip>
}

const initial = (name: string | null) => (name?.trim()[0] ?? '?').toUpperCase()
const pct = (done = 0, total = 0) => (total ? (done / total) * 100 : 0)
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

/** Schedule end time; "Locked" when the kid's devices are already off. */
const locksAt = (kid: TodayKid) => {
  if (kid.locks_at) return clock(kid.locks_at)
  return kid.devices.length && !kid.devices.some((d) => d.online) ? 'Locked' : '—'
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
                  <div className="p-kid-avatar">{initial(kid.name)}</div>
                  <div className="p-kid-info">
                    <div className="p-kid-name">{kid.name}</div>
                    <div className="p-kid-progress">
                      {kid.done ?? 0} of {kid.total ?? 0} chores
                      {kid.progress ? ` · Level ${kid.progress.level}` : ''}
                    </div>
                  </div>
                  <div className="p-kid-status">{stateChip(kid)}</div>
                  {selectedKid?.id === kid.id && (
                    <div className="p-kid-expanded" data-testid="kid-expanded">
                      <div className="p-track">
                        <div className="p-meter-bar" style={{ width: `${pct(kid.done, kid.total)}%` }} />
                      </div>
                      <div className="p-kid-facts">
                        <div>
                          <span>Points</span>
                          <b>{kid.points ?? 0}</b>
                        </div>
                        <div>
                          <span>Streak</span>
                          <b>{kid.progress?.streak ?? 0} days</b>
                        </div>
                        <div>
                          <span>Next reward</span>
                          <b>{kid.next_reward != null ? `${kid.next_reward} pts` : '—'}</b>
                        </div>
                        <div>
                          <span>Locks at</span>
                          <b>{locksAt(kid)}</b>
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
