import { useEffect, useRef, useState } from 'react'
import { backFrom } from './viewAs'
import { useRouter } from 'next/router'
import { Button } from '@mantine/core'
import { CANT_REACH } from '../api'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { Icon } from '../parent/Icon'
import { PreviewProvider, setPreviewName, useAsKid } from '../hooks/usePreview'
import { AuthBrand } from '../components/AuthBrand'
import { StickerCard } from '../components/StickerCard'
import { ChatDock } from '../chat/ChatDock'
import { useKids } from '../hooks/useKids'
import { useKidSession, useKidToday, useMarkDone, loginMessage } from '../hooks/useKid'
import { useLook } from '../parent/useLook'
import type { KidWhoami } from '../types'
import { AwardOverlay } from './AwardOverlay'
import { KidApp } from './KidApp'
import { KidIntroSwipe } from './KidIntroSwipe'
import { KidPicker } from './KidPicker'
import { Locker } from './Locker'
import { PinPad } from './PinPad'

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
  const [introComplete, setIntroComplete] = useState(false)
  const preview = useAsKid() !== null
  const today = useKidToday(onExit)
  const done = useMarkDone(onExit)
  const d = today.data
  if (!d && today.isError)
    return (
      <Narrow>
        <Msg>{CANT_REACH}</Msg>
        <Button size="lg" onClick={() => today.refetch()}>
          Retry
        </Button>
      </Narrow>
    )
  if (!d)
    return (
      <Narrow>
        <Msg>Loading…</Msg>
      </Narrow>
    )
  if (lockerOpen && d.progress)
    return (
      <Narrow wide>
        <Locker
          name={name ?? 'You'}
          avatar={avatar ?? null}
          level={d.progress.level}
          title={d.progress.title}
          onClose={() => setLockerOpen(false)}
        />
      </Narrow>
    )
  return (
    <>
      <KidApp
        d={d}
        name={name ?? 'You'}
        avatar={avatar ?? null}
        kidId={kidId}
        preview={preview}
        onExit={onExit}
        onLocker={() => setLockerOpen(true)}
        canSwitch={canSwitch}
        done={done}
      >
        {!d.locked && !introComplete && !preview && <KidIntroSwipe onComplete={() => setIntroComplete(true)} />}
      </KidApp>
      {!preview && <AwardOverlay onExpired={onExit} onLocker={() => setLockerOpen(true)} />}
      {!preview && d.age_group !== 'little' && <ChatDock kid meId={kidId ?? null} />}
    </>
  )
}

/** Narrow centred column for the sign-in, loading and locker screens. */
const Narrow = ({ children, wide }: { children: React.ReactNode; wide?: boolean }) => (
  <main className="f-shell" style={{ minHeight: '100vh' }}>
    <div className={wide ? 'f-main' : 'f-main f-auth'} style={wide ? { maxWidth: 640 } : undefined}>
      {children}
    </div>
  </main>
)

/** Parent-only read-only look at a kid's screen (/kid?as=<id>), full width like the real one (08 phone 3 bar). */
function KidPreview({ id }: { id: number }) {
  useLook('kid')
  const router = useRouter()
  const kids = useKids().data
  const kid = (kids ?? []).find((k) => k.id === id)
  const name = kid?.full_name ?? 'kid'
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[role=dialog]') && router.push(backFrom(router.query.back, id))
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [router, id])
  useEffect(() => {
    setPreviewName(kid?.full_name ?? null)
    return () => setPreviewName(null)
  }, [kid?.full_name])
  return (
    <PreviewProvider value={id}>
      <div className="k-preview">
        <div className="k-pv" role="status" style={{ backgroundColor: '#292928' }}>
          <Icon name="visibility" />
          <span>{`Viewing as ${name} · preview`}</span>
          <button type="button" onClick={() => router.push(backFrom(router.query.back, id))}>
            <Icon name="arrow_back" />
            Back to parent
          </button>
        </div>
        <Session name={kid?.full_name ?? undefined} avatar={kid?.avatar} kidId={id} onExit={() => {}} canSwitch={false} />
      </div>
    </PreviewProvider>
  )
}

/** Gate: only a logged-in parent gets the preview; anyone else sees the normal kid screen. */
function PreviewGate({ id }: { id: number }) {
  const { user, isLoading } = useUnifiedAuth()
  if (isLoading)
    return (
      <Narrow>
        <Msg>Loading…</Msg>
      </Narrow>
    )
  return user?.role === 'parent' ? <KidPreview id={id} /> : <KidScreen />
}

export function KidPage() {
  const as = Number(useRouter().query?.as)
  return as > 0 ? <PreviewGate id={as} /> : <KidScreen />
}

/** Kid screen: who is this, PIN if needed, then lock or unlocked view. Kid auth only. */
function KidScreen() {
  useLook('kid')
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

  if (authed) return <Session name={who?.full_name ?? undefined} avatar={who?.avatar} kidId={who?.id ?? kidId} onExit={exit} canSwitch={kids.length > 1} />
  return (
    <main className="f-shell" style={{ minHeight: '100vh' }}>
      <div className="f-main f-auth">
        <AuthBrand />
        {body}
      </div>
    </main>
  )
}
