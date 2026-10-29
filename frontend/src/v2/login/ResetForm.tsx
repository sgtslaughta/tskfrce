import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { api } from '@/v2/api'
import { useLook } from '@/v2/parent/useLook'
import { Icon } from '@/v2/parent/Icon'
import { ErrorPanel, Skeleton } from '@/v2/parent/states'
import { AuthBrand } from '@/v2/components/AuthBrand'
import { useLinkCheck } from './useLinkCheck'

/** Set a new password from a parent's one-time reset link. */
export function ResetForm({ token }: { token: string | undefined }) {
  useLook('parent')
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showAgain, setShowAgain] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const check = useLinkCheck<void>(token ? `/auth/reset/${encodeURIComponent(token)}` : null)
  const mismatch = again !== '' && again !== password

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters for the password.')
    if (password !== again) return setError('The two passwords do not match.')
    setBusy(true)
    setError('')
    try {
      await api('/auth/reset', { method: 'POST', body: { token, password } })
      router.replace('/login?reset=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Try again.')
      setBusy(false)
    }
  }

  return (
    <main className="p-auth-container">
      <AuthBrand />
      <div className="p-auth-form-side">
        {token && check.state === 'gone' ? (
          <div className="p-auth-form">
            <ErrorPanel kind="expired" title="This reset link has expired" />
          </div>
        ) : token && check.state === 'checking' ? (
          <div className="p-auth-form">
            <h1>Choose a new password</h1>
            <Skeleton rows={2} />
          </div>
        ) : token ? (
          <form className="p-auth-form" onSubmit={submit}>
            <h1>Choose a new password</h1>
            <div className="p-subtitle">From the reset link another parent made for you.</div>
            {error && (
              <div className="p-auth-error" role="alert">
                <Icon name="error" />
                {error}
              </div>
            )}
            <div className="p-auth-form-field">
              <label htmlFor="reset-password">New password</label>
              <div className="p-auth-input">
                <Icon name="lock" />
                <input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  autoComplete="new-password"
                  placeholder="New password"
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
            <div className="p-auth-form-field">
              <label htmlFor="reset-again">Type it again</label>
              <div className="p-auth-input" aria-invalid={mismatch}>
                <Icon name="lock" />
                <input
                  id="reset-again"
                  type={showAgain ? 'text' : 'password'}
                  value={again}
                  onChange={(e) => setAgain(e.currentTarget.value)}
                  autoComplete="new-password"
                  placeholder="Type it again"
                  aria-describedby={mismatch ? 'reset-again-err' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowAgain(!showAgain)}
                  aria-label={showAgain ? 'Hide password again' : 'Show password again'} title={showAgain ? 'Hide password again' : 'Show password again'}
                  className="p-auth-link"
                  style={{ textDecoration: 'none' }}
                >
                  <Icon name={showAgain ? 'visibility_off' : 'visibility'} />
                </button>
              </div>
              {mismatch && (
                <span id="reset-again-err" className="p-auth-fielderr">
                  <Icon name="error" size={16} />
                  The two passwords don&apos;t match.
                </span>
              )}
            </div>
            <button type="submit" className="p-auth-button primary" disabled={busy} aria-busy={busy}>
              {busy ? 'Saving…' : 'Save password'}
              {busy && <Icon name="progress_activity" size={20} className="p-auth-spin" />}
            </button>
          </form>
        ) : (
          <div className="p-auth-form">
            <h1>Choose a new password</h1>
            <div className="p-auth-error" role="alert">
              <Icon name="error" />
              This reset link is missing its code. Ask a parent to send it again.
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
