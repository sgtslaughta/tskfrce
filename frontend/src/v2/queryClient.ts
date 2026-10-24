import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError, AuthError, CANT_REACH } from './api'

/** Parent session ended: go to login once, keeping the current page as `next`. */
export function onAuthError(err: unknown): void {
  if (!(err instanceof AuthError) || err.kid || typeof window === 'undefined') return
  const { pathname, search } = window.location
  if (pathname === '/login') return
  window.location.assign(`/login?next=${encodeURIComponent(pathname + search)}`)
}

/** Unreachable/network error: show an error panel with auto-retry after 8s. */
export function onUnreachableError(err: unknown): void {
  if (!(err instanceof ApiError) || err.status !== 0 || typeof window === 'undefined') return
  // Import ErrorPanel on demand to avoid circular deps
  if (document.querySelector('[data-unreachable-error]')) return // already showing

  const container = document.createElement('div')
  container.setAttribute('data-unreachable-error', 'true')
  container.style.cssText = 'position:fixed;inset:0;display:grid;placeItems:center;background:rgba(0,0,0,0.5);z-index:9999'

  const panel = document.createElement('div')
  panel.style.cssText = 'background:white;padding:32px;borderRadius:8px;maxWidth:400px;textAlign:center'

  const icon = document.createElement('div')
  icon.style.cssText = 'color:#8f1d13;fontSize:24px;marginBottom:8px'
  icon.textContent = '⚠️'

  const title = document.createElement('h3')
  title.style.cssText = 'margin:0 0 8px;color:#292928;fontSize:18px;fontWeight:600'
  title.textContent = "Can't reach your home box"

  const body = document.createElement('p')
  body.style.cssText = 'margin:0 0 16px;color:#5f5f5c;fontSize:14px'
  body.textContent = "Are you on the home Wi-Fi? If you're away, connect Tailscale first."

  const btn = document.createElement('button')
  btn.style.cssText = 'padding:8px 16px;background:#292928;color:#f4f4f2;border:none;borderRadius:6px;cursor:pointer;fontSize:14px'
  btn.textContent = 'Try again'
  btn.addEventListener('click', () => {
    container.remove()
    window.location.reload()
  })

  const timer = document.createElement('p')
  timer.style.cssText = 'margin:8px 0 0;fontSize:12px;color:#a8a8a4'
  timer.textContent = 'Retrying in 8s…'

  panel.appendChild(icon)
  panel.appendChild(title)
  panel.appendChild(body)
  panel.appendChild(btn)
  panel.appendChild(timer)

  container.appendChild(panel)
  document.body.appendChild(container)

  setTimeout(() => {
    if (document.body.contains(container)) {
      container.remove()
      window.location.reload()
    }
  }, 8000)
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (err) => {
        onAuthError(err)
        onUnreachableError(err)
      }
    }),
    mutationCache: new MutationCache({
      onError: (err) => {
        onAuthError(err)
        onUnreachableError(err)
      }
    }),
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        // 4xx answers won't change on retry
        retry: (n, err) => !(err instanceof ApiError && err.status < 500) && n < 2,
      },
    },
  })
}
