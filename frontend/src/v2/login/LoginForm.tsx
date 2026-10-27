import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { api } from '@/v2/api'
import { useLook } from '@/v2/parent/useLook'
import { Icon } from '@/v2/parent/Icon'
import type { SetupStatus } from '@/v2/types'
import { AuthBrand } from '@/v2/components/AuthBrand'
import { setRemember as keepSession } from '@/services/tokenStorage'

/** Only same-site paths survive; anything a browser could reinterpret falls back to "/". */
export const safeNext = (next: unknown): string => {
  if (typeof next !== 'string' || /[\x00-\x1f\x7f\s\\]/.test(next)) return '/'
  try {
    const u = new URL(next, window.location.origin)
    return u.origin === window.location.origin ? u.pathname + u.search + u.hash : '/'
  } catch {
    return '/'
  }
}

/** Parent login. A wrong password shows inline and is never logged or thrown. */
export function LoginForm() {
  useLook('parent')
  const router = useRouter()
  const { login, isAuthenticated } = useUnifiedAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [busy, setBusy] = useState(false)
  const [host, setHost] = useState('')
  const next = safeNext(router.query?.next)

  useEffect(() => {
    if (isAuthenticated) router.replace(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, next])

  useEffect(() => setHost(window.location.host), [])

  useEffect(() => {
    // first run: nobody can log in yet
    api<SetupStatus>('/setup')
      .then((s) => s.needed && router.replace('/setup'))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      keepSession(remember)
      await login({ username: username.trim(), password, remember }) // the effect above redirects
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect username or password')
      setBusy(false)
    }
  }

  return (
    <main className="p-auth-container">
      <AuthBrand />
      <div className="p-auth-form-side">
        <form className="p-auth-form" onSubmit={submit}>
          {!showForgot ? (
            <>
              <h1>Welcome back</h1>
              <div className="p-subtitle">Parents, log in to manage chores and devices.</div>
              {error && (
                <div className="p-auth-error" role="alert">
                  <Icon name="error" />
                  {error}
                </div>
              )}
              {router.query?.reset && (
                <div className="p-auth-success">
                  <Icon name="check_circle" />
                  Password saved. Log in with your new password.
                </div>
              )}
              <div className="p-auth-form-field">
                <label htmlFor="username">Username</label>
                <div className="p-auth-input">
                  <Icon name="person" />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.currentTarget.value)}
                    autoComplete="username"
                    placeholder="Username"
                  />
                </div>
              </div>
              <div className="p-auth-form-field">
                <label htmlFor="password">Password</label>
                <div className="p-auth-input">
                  <Icon name="lock" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                    autoComplete="current-password"
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}
                    className="p-auth-link"
                    style={{ textDecoration: 'none' }}
                  >
                    <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
                  </button>
                </div>
              </div>
              <div className="p-auth-row">
                <label className="p-auth-checkbox">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.currentTarget.checked)}
                  />
                  <i>
                    <Icon name="check" size={14} />
                  </i>
                  Keep me logged in
                </label>
                <button type="button" className="p-auth-link" onClick={() => setShowForgot(true)}>
                  Forgot password?
                </button>
              </div>
              <button type="submit" className="p-auth-button primary" disabled={busy} aria-busy={busy}>
                {busy ? 'Logging in…' : 'Log in'}
                <Icon name={busy ? 'progress_activity' : 'arrow_forward'} size={20} className={busy ? 'p-auth-spin' : undefined} />
              </button>
              <div className="p-auth-or">or</div>
              <Link href="/kid" className="p-auth-kid-card">
                <div className="p-auth-kid-bubble">
                  <Icon name="checklist" />
                </div>
                <div>
                  I&apos;m a kid
                  <small>Go to your checklist, no password</small>
                </div>
                <Icon name="chevron_right" size={20} className="p-auth-kid-icon" />
              </Link>
            </>
          ) : (
            <div className="p-auth-pane">
              <h1>Forgot your password?</h1>
              <div className="p-subtitle">There&apos;s no email reset: the box is offline-first.</div>
              <div className="p-auth-invite">
                <Icon name="supervisor_account" />
                <div>
                  <b>Ask another parent</b>
                  <small>They can make you a reset link in Settings → Parents</small>
                </div>
              </div>
              <div className="p-auth-cli">
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <Icon name="terminal" />
                  <div>
                    <b>Only parent?</b>
                    <small>
                      On the box:{' '}
                      <code>docker compose exec backend python -m app.cli reset-password &lt;you&gt;</code>
                    </small>
                  </div>
                </div>
              </div>
              <button type="button" className="p-auth-link" onClick={() => setShowForgot(false)}>
                Back to log in
              </button>
            </div>
          )}
          <div className="p-auth-footer">t@sk4ce{host && ` · ${host}`}</div>
        </form>
      </div>
    </main>
  )
}
