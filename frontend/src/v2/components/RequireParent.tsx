import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { api, KID_TOKEN_KEY } from '../api'
import { BoxStarting, EmptyState, ErrorPanel, SetupResuming, WaitingState } from '../parent/states'
import { startingUp } from '../parent/freshness'
import { useLook } from '../parent/useLook'
import type { SetupStatus } from '../types'

const SETUP_KEY = ['setup']
export const STEP_KEY = ['setup-step']

/** Call after the setup wizard succeeds so guards stop sending parents back to /setup. */
export function markSetupDone(queryClient: QueryClient): void {
  queryClient.setQueryData<SetupStatus>(SETUP_KEY, { needed: false })
}

// set by ParentShell's Log out so the guard doesn't race it with /login?next= (and can say "Signing you out…")
let signingOut = false
const watchers = new Set<() => void>()
const setSigningOut = (v: boolean) => {
  signingOut = v
  watchers.forEach((w) => w())
}
export const startSignOut = () => setSigningOut(true)
export const cancelSignOut = () => setSigningOut(false)
const watchSignOut = (w: () => void) => {
  watchers.add(w)
  return () => void watchers.delete(w)
}

/** Parent-only route guard: first-run setup → /setup, logged out → /login?next=, kid → /kid. */
export function RequireParent({ children }: { children: ReactNode }) {
  useLook('parent')
  const router = useRouter()
  const { isInitialized, isAuthenticated, user } = useUnifiedAuth()
  const setup = useQuery({
    queryKey: SETUP_KEY,
    queryFn: () => api<SetupStatus>('/setup'),
    staleTime: 30_000,
  })

  const out = useSyncExternalStore(watchSignOut, () => signingOut, () => false)
  // a parent whose first-run wizard never reached Finish goes back to its step
  const resume = useQuery({
    queryKey: STEP_KEY,
    queryFn: () => api<{ step: number | null }>('/setup/step'),
    enabled: isAuthenticated && !!user && user.role !== 'kid' && setup.data?.needed === false,
    staleTime: 30_000,
    retry: false,
  })
  const resumeStep = typeof resume.data?.step === 'number' ? resume.data.step : null

  // a kid's own device (kid session, no parent login) opened a parent page: back to the checklist
  const kidDevice =
    isInitialized && !isAuthenticated && typeof window !== 'undefined' && !!localStorage.getItem(KID_TOKEN_KEY)

  // null = still deciding, '' = allowed
  const target =
    !setup.isSuccess || !isInitialized
      ? null
      : setup.data.needed
        ? '/setup'
        : !isAuthenticated || !user
          ? out
            ? '/login'
            : `/login?next=${encodeURIComponent(router.asPath)}`
          : user.role === 'kid'
            ? '/kid'
            : resume.isPending
              ? null
              : resumeStep
                ? '/setup'
                : ''

  useEffect(() => {
    if (isAuthenticated) cancelSignOut()
  }, [isAuthenticated])

  useEffect(() => {
    if (!kidDevice) return
    const t = setTimeout(() => router.replace('/kid'), 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidDevice])

  useEffect(() => {
    if (target && !kidDevice) router.replace(target)
    // re-run only when the target changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  // signed-in state could not be confirmed while the box was down: reload so auth re-checks the kept tokens
  if (out) return <Guard><WaitingState title="Signing you out…" /></Guard>
  if (setup.isError)
    return <Unreachable error={setup.error} onRetry={() => (isAuthenticated ? setup.refetch() : window.location.reload())} />
  if (kidDevice && !setup.data?.needed) return <ForParents onGo={() => router.replace('/kid')} />
  if (target === '/setup' && resumeStep) return <Guard><SetupResuming step={resumeStep} /></Guard>
  if (target !== '') return <Checking />
  return <>{children}</>
}

/** Deciding where to go (setup / login / kid): a quiet spinner in the parent look. */
function Checking() {
  return (
    <Guard>
      <span className="p-gate-spin" role="status" aria-label="Loading" />
    </Guard>
  )
}

/** Mockup 05 "Kid on a parent page": short note, then the checklist. */
function ForParents({ onGo }: { onGo: () => void }) {
  return (
    <Guard>
      <EmptyState
        icon="checklist"
        title="This part is for parents"
        body="Taking you to your checklist…"
        heading="h1"
        actions={[{ label: 'Go now', icon: 'arrow_forward', onClick: onGo }]}
      />
    </Guard>
  )
}

/** Full-page state before the shell exists. */
function Guard({ children }: { children: ReactNode }) {
  useLook('parent')
  return <main className="p-guard-state">{children}</main>
}

/**
 * The home box didn't answer the very first request. A 502 right after it was switched on means it is
 * still starting (polls quietly); anything else, or waiting too long, is the "can't reach" panel.
 */
function Unreachable({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const [t0] = useState(Date.now)
  const [, tick] = useState(0)
  const starting = startingUp(error, Date.now() - t0)
  useEffect(() => {
    if (!starting) return
    const t = setInterval(() => {
      tick((n) => n + 1)
      onRetry()
    }, 3000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starting])
  return (
    <Guard>
      {starting ? <BoxStarting /> : <ErrorPanel kind="unreachable" error={error instanceof TypeError ? undefined : error} onRetry={onRetry} />}
    </Guard>
  )
}
