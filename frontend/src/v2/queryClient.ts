import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError, AuthError } from './api'

/** Parent session ended: go to login once, keeping the current page as `next`. */
export function onAuthError(err: unknown): void {
  if (!(err instanceof AuthError) || err.kid || typeof window === 'undefined') return
  const { pathname, search } = window.location
  if (pathname === '/login') return
  window.location.assign(`/login?next=${encodeURIComponent(pathname + search)}`)
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    // unreachable box: each page shows its own ErrorPanel with Try again (mockup 05)
    queryCache: new QueryCache({ onError: onAuthError }),
    mutationCache: new MutationCache({ onError: onAuthError }),
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        // 4xx answers won't change on retry
        retry: (n, err) => !(err instanceof ApiError && err.status < 500) && n < 2,
      },
    },
  })
}
