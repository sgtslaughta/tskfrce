import { useEffect, useRef, useState } from 'react'
import { backFrom } from './viewAs'
import { useRouter } from 'next/router'
import { CANT_REACH } from '../api'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { Icon } from '../parent/Icon'
import { PreviewProvider, setPreviewName, useAsKid } from '../hooks/usePreview'
import { useKids } from '../hooks/useKids'
import { useKidSession, useKidToday, useMarkDone, loginMessage } from '../hooks/useKid'
import { useLook } from '../parent/useLook'
import type { KidWhoami } from '../types'
import { AwardOverlay } from './AwardOverlay'
import { KidApp } from './KidApp'
import { KidIntroSwipe } from './KidIntroSwipe'
import { KidPicker } from './KidPicker'
import { PinPad } from './PinPad'

type K = KidWhoami['kids'][number]

const Msg = ({ children }: { children: string }) => <p className="k-gate-msg">{children}</p>

const KBtn = ({ onClick, plain, children }: { onClick: () => void; plain?: boolean; children: string }) => (
  <button type="button" className="r-btn" data-tone={plain ? 'plain' : undefined} onClick={onClick}>
    {children}
  </button>
)

/** Kid sign-in / status screen: brand, then the content, in the kid look (kid-gate.css). */
const Gate = ({ children }: { children: React.ReactNode }) => (
  <main className="k-app k-gate">
    <div className="k-gate-in">
      <div className="k-brand">
        <i aria-hidden>@</i>t@sk4ce
      </div>
      {children}
    </div>
  </main>
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
      <Gate>
        <Msg>{CANT_REACH}</Msg>
        <KBtn onClick={() => today.refetch()}>Retry</KBtn>
      </Gate>
    )
  if (!d)
    return (
      <Gate>
        <Msg>Loading…</Msg>
      </Gate>
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
        lockerOpen={lockerOpen}
        onLockerClose={() => setLockerOpen(false)}
        canSwitch={canSwitch}
        done={done}
      >
        {!d.locked && !introComplete && !preview && <KidIntroSwipe kidId={kidId} onComplete={() => setIntroComplete(true)} />}
      </KidApp>
      {!preview && <AwardOverlay onExpired={onExit} onLocker={() => setLockerOpen(true)} />}
    </>
  )
}

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
      <Gate>
        <Msg>Loading…</Msg>
      </Gate>
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
        <h1 className="k-disp">
          <span className="k-pin-who">
            <span aria-hidden className="k-pick-av">
              {who.avatar || '🙂'}
            </span>
            {who.full_name}, enter your PIN
          </span>
        </h1>
        <PinPad busy={login.isPending} error={err} onSubmit={(pin) => login.mutate({ kid_id: who.id, pin })} />
        {kids.length > 1 && (
          <KBtn plain onClick={exit}>
            Not me
          </KBtn>
        )}
      </>
    )
  else if (!who)
    body = (
      <>
        <h1 className="k-disp">Who is this?</h1>
        <KidPicker kids={kids} onPick={pick} />
      </>
    )
  else
    body = err ? (
      <>
        <Msg>{err}</Msg>
        <KBtn onClick={exit}>Try again</KBtn>
      </>
    ) : (
      <Msg>Loading…</Msg>
    )

  if (authed) return <Session name={who?.full_name ?? undefined} avatar={who?.avatar} kidId={who?.id ?? kidId} onExit={exit} canSwitch={kids.length > 1} />
  return (
    <Gate>{body}</Gate>
  )
}
