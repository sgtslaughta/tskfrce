import { useEffect, useState, type ReactNode } from 'react'
import { openChat, openChatList } from '../chat/dock'
import { useThreads } from '../hooks/useChat'
import { useInbox } from '../hooks/useInbox'
import { useMarkSeen } from '../hooks/useKid'
import { askOnFirstClick, useOsNotify } from '../osNotify'
import type { KidToday } from '../types'
import { KidAlerts } from './KidAlerts'
import { tally } from './kidChips'
import { KidNav, type KidTab } from './KidNav'
import { MePage } from './MePage'
import { KidMode } from './modes/KidMode'
import { LittleMode } from './modes/LittleMode'
import { TeenMode } from './modes/TeenMode'
import { RewardsSection } from './RewardsSection'

const MODES = { little: LittleMode, kid: KidMode, teen: TeenMode }
const noop = () => {}

export interface KidAppProps {
  d: KidToday
  name: string
  avatar: string | null
  kidId?: number | null
  preview: boolean
  onExit: () => void
  onLocker: () => void
  canSwitch: boolean
  done: { mutate: (id: number) => void; isPending: boolean; variables?: number }
  /** shown above the chores (first-visit intro) */
  children?: ReactNode
}

/** The kid app: full-width shell, age-mode nav, and the Chores / Rewards / Alerts / Me tabs. */
export function KidApp({ d, name, avatar, kidId, preview, onExit, onLocker, canSwitch, done, children }: KidAppProps) {
  const [tab, setTab] = useState<KidTab>('chores')
  const [focusId, setFocusId] = useState<number | null>(null)
  const mode = d.age_group === 'little' || d.age_group === 'teen' ? d.age_group : 'kid'
  const seen = useMarkSeen()
  const threads = useThreads(true, !preview && mode !== 'little')
  const inbox = useInbox(true, !preview && mode !== 'little')
  useOsNotify(inbox.data?.items, noop) // OS pop-ups while the tab is in the background, as the old bell did
  useEffect(() => {
    if (!preview) askOnFirstClick()
  }, [preview])
  const Mode = MODES[mode]
  const badges = {
    chores: tally(d.chores).todo,
    chat: threads.data?.total ?? 0,
    alerts: inbox.data?.unread ?? 0,
  }
  const onTab = (t: KidTab) => {
    setFocusId(null)
    if (t === 'chat' && !preview) openChatList()
    else setTab(t)
  }
  const elsewhere = <p className="k-hint k-elsewhere">{`Alerts and chat show on ${name}'s own screen.`}</p>

  let body: ReactNode
  if (tab === 'rewards')
    body = (
      <RewardsSection onExpired={onExit} mode={mode} />
    )
  else if (tab === 'me')
    body = (
      <MePage name={name} avatar={avatar} progress={d.progress} preview={preview} onLocker={onLocker} canSwitch={canSwitch} onExit={onExit} kidId={kidId} />
    )
  else if (tab === 'chat' || tab === 'alerts') body = preview ? elsewhere : <KidAlerts
        onChores={(id) => {
          setFocusId(id)
          setTab('chores')
        }}
      />
  else
    body = (
      <>
        {children}
        <Mode
          d={d}
          focusId={focusId}
          name={name}
          avatar={avatar}
          now={Date.now()}
          onDone={done.mutate}
          busyId={done.isPending ? done.variables ?? null : null}
          onSeen={seen.mutate}
          onChat={preview || mode === 'little' ? undefined : (id) => openChat('chore', String(id))}
        />
      </>
    )

  return (
    <div className="k-app" data-mode={mode}>
      <KidNav mode={mode} tab={tab} onTab={onTab} badges={badges} avatar={avatar} />
      <main className="k-main">
        <div className="k-inner">{body}</div>
      </main>
    </div>
  )
}
