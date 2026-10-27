import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Tabs } from '@mantine/core'
import { useToday } from '../hooks/useToday'
import type { TodayKid } from '../types'
import { NeedsYouList } from './NeedsYouList'
import { Chip } from '../parent/Chip'
import { ListHeader } from '../parent/ListHeader'
import { KidFacts, initial } from './KidFacts'

const stateChip = (kid: TodayKid) => {
  if (kid.online_all) return <Chip tone="acc" icon="cloud_done">Online</Chip>
  if ((kid.needs_you_count ?? 0) > 0) return <Chip tone="lav" icon="hourglass_top">Needs OK</Chip>
  if (kid.total && kid.done === kid.total) return <Chip tone="grey" icon="check_circle">All done</Chip>
  return <Chip tone="grey" icon="lock">Locked</Chip>
}

const pct = (done = 0, total = 0) => (total ? (done / total) * 100 : 0)

export function KidList({ onSelectKid, selectedKid }: { onSelectKid: (kid: TodayKid) => void; selectedKid?: TodayKid }) {
  const { data } = useToday()
  const [tab, setTab] = useState<string | null>('today')
  const want = useRouter().query.tab // ?tab=needs from a notification
  useEffect(() => {
    if (want === 'needs') setTab('needs')
  }, [want])
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
                  onClick={() => onSelectKid(kid)}
                >
                  <div className="p-kid-avatar">{initial(kid.name)}</div>
                  <div className="p-kid-info">
                    <div className="p-kid-name">{kid.name}</div>
                    <div className="p-kid-progress">
                      <span>{kid.done ?? 0} of {kid.total ?? 0} chores</span>
                      {kid.progress && <span>Level {kid.progress.level}</span>}
                    </div>
                    <div className="p-track" role="progressbar" aria-label={`${kid.name}'s chores`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct(kid.done, kid.total)}>
                      <div className="p-meter-bar" style={{ width: `${pct(kid.done, kid.total)}%` }} />
                    </div>
                  </div>
                  <div className="p-kid-status">{stateChip(kid)}</div>
                  {selectedKid?.id === kid.id && (
                    <div className="p-kid-expanded" data-testid="kid-expanded">
                      <KidFacts kid={kid} />
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
