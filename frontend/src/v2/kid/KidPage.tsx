import { useEffect, useRef, useState } from 'react'
import { Button } from '@mantine/core'
import { CANT_REACH } from '../api'
import { ProgressHeader } from '../components/ProgressHeader'
import { Bell } from '../components/Bell'
import { LockBadge } from '../components/LockBadge'
import { StickerCard } from '../components/StickerCard'
import { ChatDock } from '../chat/ChatDock'
import { openChat } from '../chat/dock'
import { useThreads } from '../hooks/useChat'
import { useKidSession, useKidToday, useMarkDone, loginMessage } from '../hooks/useKid'
import type { KidWhoami } from '../types'
import { AwardOverlay } from './AwardOverlay'
import { KidChecklist } from './KidChecklist'
import { FamilySection } from './FamilySection'
import { KidPicker } from './KidPicker'
import { Locker } from './Locker'
import { PinPad } from './PinPad'
import { RewardsSection } from './RewardsSection'
import { UnlockedView } from './UnlockedView'

type K = KidWhoami['kids'][number]

const Msg = ({ children }: { children: string }) => (
  <StickerCard>
    <p className="f-display" style={{ margin: 0, padding: 12, fontSize: 24, textAlign: 'center' }}>
      {children}
    </p>
  </StickerCard>
)

const SwitchBtn = ({ onClick }: { onClick: () => void }) => (
  <Button variant="default" size="lg" onClick={onClick}>
    Not me
  </Button>
)

function Session({ name, avatar, kidId, onExit, canSwitch }: { name?: string; avatar?: string | null; kidId?: number | null; onExit: () => void; canSwitch: boolean }) {
  const [lockerOpen, setLockerOpen] = useState(false)
  const threads = useThreads(true)
  const today = useKidToday(onExit)
  const done = useMarkDone(onExit)
  const d = today.data
  const unread = Object.fromEntries(
    (threads.data?.threads ?? []).filter((t) => t.kind === 'chore').map((t) => [t.task_id, t.unread]),
  )
  if (!d && today.isError)
    return (
      <>
        <Msg>{CANT_REACH}</Msg>
        <Button size="lg" onClick={() => today.refetch()}>
          Retry
        </Button>
      </>
    )
  if (!d) return <Msg>Loading…</Msg>
  if (lockerOpen && d.progress)
    return (
      <Locker
        name={name ?? 'You'}
        avatar={avatar ?? null}
        level={d.progress.level}
        title={d.progress.title}
        onClose={() => setLockerOpen(false)}
      />
    )
  const head = d.progress && (
    <StickerCard>
      <ProgressHeader name={name ?? 'You'} avatar={avatar ?? null} kid progress={d.progress} />
      <Button variant="default" size="md" mt="xs" onClick={() => setLockerOpen(true)}>
        Customize
      </Button>
    </StickerCard>
  )
  const switcher = canSwitch && <SwitchBtn onClick={onExit} />
  if (!d.locked)
    return (
      <>
        {head}
        <UnlockedView points={d.points_balance} done={d.chores.filter((c) => c.state === 'done').length} />
        <RewardsSection onExpired={onExit} />
        <FamilySection meId={kidId} />
        <AwardOverlay onExpired={onExit} onLocker={() => setLockerOpen(true)} />
        {switcher}
      </>
    )
  return (
    <>
      {head}
      <StickerCard tone="red">
        <div style={{ display: 'grid', justifyItems: 'center', gap: 8, padding: 12, textAlign: 'center' }}>
          <LockBadge online={false} size={120} />
          <h1 style={{ margin: 0, fontSize: 36 }}>Internet is paused</h1>
          <p style={{ margin: 0, fontSize: 20 }}>Finish your chores to unlock.</p>
        </div>
      </StickerCard>
      <StickerCard>
        {name && <h2 style={{ margin: '0 0 8px' }}>{name}</h2>}
        <KidChecklist
          chores={d.chores}
          onDone={(id) => done.mutate(id)}
          busyId={done.isPending ? done.variables : null}
          unread={unread}
          onChat={(id) => openChat('chore', String(id))}
        />
      </StickerCard>
      <RewardsSection onExpired={onExit} />
      <FamilySection meId={kidId} />
      <AwardOverlay onExpired={onExit} onLocker={() => setLockerOpen(true)} />
      {switcher}
    </>
  )
}

/** Kid screen: who is this, PIN if needed, then lock or unlocked view. Kid auth only. */
export function KidPage() {
  const { ready, authed, kidId, whoami, login, logout } = useKidSession()
  const [picked, setPicked] = useState<K | null>(null)
  const tried = useRef(false)
  const kids = whoami.data?.kids ?? []
  const solo = kids.length === 1 ? kids[0] : null
  const who = picked ?? solo ?? (authed ? kids.find((k) => k.id === kidId) ?? null : null)
  const err = login.error ? loginMessage(login.error) : null

  // exactly one kid, no PIN: log in without asking (once)
  useEffect(() => {
    if (ready && !authed && solo && !solo.has_pin && !tried.current) {
      tried.current = true
      login.mutate({ kid_id: solo.id })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authed, solo])

  const exit = () => {
    tried.current = false
    setPicked(null)
    logout()
  }
  const pick = (k: K) => {
    setPicked(k)
    if (!k.has_pin) login.mutate({ kid_id: k.id })
  }

  let body
  if (!ready || (!authed && whoami.isPending)) body = <Msg>Loading…</Msg>
  else if (authed) body = <Session name={who?.full_name ?? undefined} avatar={who?.avatar} kidId={who?.id ?? kidId} onExit={exit} canSwitch={kids.length > 1} />
  else if (whoami.isError) body = <Msg>{CANT_REACH}</Msg>
  else if (!whoami.data?.device) body = <Msg>This device isn&apos;t set up yet. Ask a parent to add it.</Msg>
  else if (!kids.length) body = <Msg>No kid is set up on this device. Ask a parent to add one.</Msg>
  else if (who?.has_pin)
    body = (
      <>
        <h1 style={{ textAlign: 'center', margin: 0 }}>
          {who.avatar} {who.full_name}, enter your PIN
        </h1>
        <PinPad busy={login.isPending} error={err} onSubmit={(pin) => login.mutate({ kid_id: who.id, pin })} />
        {kids.length > 1 && <SwitchBtn onClick={exit} />}
      </>
    )
  else if (!who)
    body = (
      <>
        <h1 style={{ textAlign: 'center', margin: 0 }}>Who is this?</h1>
        <KidPicker kids={kids} onPick={pick} />
      </>
    )
  else
    body = err ? (
      <>
        <Msg>{err}</Msg>
        <Button size="lg" onClick={exit}>
          Try again
        </Button>
      </>
    ) : (
      <Msg>Loading…</Msg>
    )

  return (
    <main className="f-shell" style={{ minHeight: '100vh' }}>
      <div className="f-main" style={{ maxWidth: 520 }}>
        {authed && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Bell kid />
          </div>
        )}
        {body}
      </div>
      {authed && <ChatDock kid meId={who?.id ?? kidId ?? null} />}
    </main>
  )
}
