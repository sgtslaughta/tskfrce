import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { api } from '../api'
import type { SetupStatus } from '../types'

/** Parent-only route guard: first-run setup → /setup, logged out → /login?next=, kid → /kid. */
export function RequireParent({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { isInitialized, isAuthenticated, user } = useUnifiedAuth()
  const setup = useQuery({
    queryKey: ['setup'],
    queryFn: () => api<SetupStatus>('/setup'),
    staleTime: Infinity,
  })

  // a failed setup check falls through to the login check
  const setupKnown = setup.isSuccess || setup.isError
  const target = !setupKnown
    ? null
    : setup.data?.needed
      ? '/setup'
      : !isInitialized
        ? null
        : !isAuthenticated || !user
          ? `/login?next=${encodeURIComponent(router.asPath)}`
          : user.role === 'kid'
            ? '/kid'
            : ''

  useEffect(() => {
    if (target) router.push(target)
    // router is stable for our purposes; re-run only when the target changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  if (target !== '') {
    return (
      <div className="f-shell" role="status" style={{ display: 'grid', placeItems: 'center' }}>
        Loading…
      </div>
    )
  }
  return <>{children}</>
}
