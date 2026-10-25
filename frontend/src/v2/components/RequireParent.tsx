import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { api } from '../api'
import { useLook } from '../parent/useLook'
import { ErrorPanel } from '../parent/states'
import type { SetupStatus } from '../types'

const SETUP_KEY = ['setup']

/** Call after the setup wizard succeeds so guards stop sending parents back to /setup. */
export function markSetupDone(queryClient: QueryClient): void {
  queryClient.setQueryData<SetupStatus>(SETUP_KEY, { needed: false })
}

// set by FridgeShell's Log out so the guard doesn't race it with /login?next=
let signingOut = false
export function startSignOut(): void {
  signingOut = true
}
export function cancelSignOut(): void {
  signingOut = false
}

/** Parent-only route guard: first-run setup → /setup, logged out → /login?next=, kid → /kid. */
export function RequireParent({ children }: { children: ReactNode }) {
  useLook('parent') // the unreachable panel shows before ParentShell has set the look
  const router = useRouter()
  const { isInitialized, isAuthenticated, user } = useUnifiedAuth()
  const setup = useQuery({
    queryKey: SETUP_KEY,
    queryFn: () => api<SetupStatus>('/setup'),
    staleTime: 30_000,
  })

  // null = still deciding, '' = allowed
  const target =
    !setup.isSuccess || !isInitialized
      ? null
      : setup.data.needed
        ? '/setup'
        : !isAuthenticated || !user
          ? signingOut
            ? '/login'
            : `/login?next=${encodeURIComponent(router.asPath)}`
          : user.role === 'kid'
            ? '/kid'
            : ''

  useEffect(() => {
    if (isAuthenticated) signingOut = false
  }, [isAuthenticated])

  useEffect(() => {
    if (target) router.replace(target)
    // re-run only when the target changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  if (setup.isError) {
    return <ErrorPanel kind="unreachable" onRetry={() => setup.refetch()} />

  }
  if (target !== '') {
    return (
      <div className="f-shell" role="status" style={{ display: 'grid', placeItems: 'center' }}>
        Loading…
      </div>
    )
  }
  return <>{children}</>
}
