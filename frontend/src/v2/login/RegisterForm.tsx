import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/router'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { api } from '@/v2/api'
import { useLook } from '@/v2/parent/useLook'
import { Icon } from '@/v2/parent/Icon'
import { ErrorPanel, Skeleton } from '@/v2/parent/states'
import { useLinkCheck } from './useLinkCheck'
import { AuthBrand } from '@/v2/components/AuthBrand'

interface InviteInfo {
  username: string
  inviter: string | null
  family_name: string
  expires_at: string
}

/** "Expires in 22 hours" from the server's expiry time. */
export function expiresIn(iso: string, now = Date.now()): string {
  const h = Math.round((new Date(iso).getTime() - now) / 3_600_000)
  return h < 1 ? 'Expires in less than an hour' : `Expires in ${h} ${h === 1 ? 'hour' : 'hours'}`
}

/** Redeem a parent's invite link. The username comes from the invite itself. */
export function RegisterForm({ token }: { token: string | undefined }) {
  useLook('parent')
  const router = useRouter()
  const { login } = useUnifiedAuth()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const check = useLinkCheck<InviteInfo>(token ? `/auth/invite/${encodeURIComponent(token)}` : null)
  const invite = check.state === 'ok' ? check.data : null
  const [again, setAgain] = useState('')
  const mismatch = again !== '' && again !== password
  const [busy, setBusy] = useState(false)

  // Calculate password strength (simple: count character types)
  const getStrength = (pwd: string): number => {
    if (!pwd) return 0
    let strength = 0
    if (pwd.length >= 8) strength++
    if (pwd.length >= 12) strength++
    if (/[A-Z]/.test(pwd)) strength++
    if (/\d/.test(pwd)) strength++
    return Math.min(strength, 4)
  }

  const strength = getStrength(password)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters for the password.')
    if (password !== again) return setError('The two passwords do not match.')
    setBusy(true)
    setError('')
    try {
      const made = await api<{ username: string }>('/auth/register', {
        method: 'POST',
        body: { token, password, full_name: fullName.trim() || null },
      })
      await login({ username: made.username, password })
      router.replace('/')
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
            <ErrorPanel kind="expired" />
          </div>
        ) : token && check.state === 'checking' ? (
          <div className="p-auth-form">
            <h1>Join the family</h1>
            <Skeleton rows={3} />
          </div>
        ) : token ? (
          <form className="p-auth-form" onSubmit={submit}>
            <h1>Join the family</h1>
            {invite && (
              <>
                <div className="p-subtitle">
                  {invite.inviter ? `${invite.inviter} invited you to ${invite.family_name}.` : `You're invited to ${invite.family_name}.`}
                </div>
                <div className="p-auth-invite">
                  <div className="av">{(invite.inviter ?? invite.username).charAt(0).toUpperCase()}</div>
                  <div>
                    <b>{invite.inviter ? `Invite from ${invite.inviter}` : `Invite for ${invite.username}`}</b>
                    <small>{expiresIn(invite.expires_at)}</small>
                  </div>
                </div>
              </>
            )}
            {error && (
              <div className="p-auth-error" role="alert">
                <Icon name="error" />
                {error}
              </div>
            )}
            <div className="p-auth-form-field">
              <label htmlFor="fullname">Your name</label>
              <div className="p-auth-input">
                <Icon name="badge" />
                <input
                  id="fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.currentTarget.value)}
                  placeholder="Your name"
                />
              </div>
            </div>
            <div className="p-auth-form-field">
              <label htmlFor="reg-username">Username</label>
              <div className="p-auth-input">
                <Icon name="person" />
                <input
                  id="reg-username"
                  type="text"
                  value={invite?.username ?? ''}
                  readOnly
                />
              </div>
            </div>
            <div className="p-auth-form-field">
              <label htmlFor="reg-password">Choose a password</label>
              <div className="p-auth-input">
                <Icon name="lock" />
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  autoComplete="new-password"
                  placeholder="Choose a password"
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
            <div className="p-auth-strength">
              {[...Array(4)].map((_, i) => (
                <i key={i} className={i < strength ? 'on' : ''} />
              ))}
            </div>
            <div className="p-auth-form-field">
              <label htmlFor="reg-again">Type it again</label>
              <div className="p-auth-input" aria-invalid={mismatch}>
                <Icon name="lock" />
                <input
                  id="reg-again"
                  type={showPassword ? 'text' : 'password'}
                  value={again}
                  onChange={(e) => setAgain(e.currentTarget.value)}
                  autoComplete="new-password"
                  placeholder="Type it again"
                  aria-describedby={mismatch ? 'reg-again-err' : undefined}
                />
              </div>
              {mismatch && (
                <span id="reg-again-err" className="p-auth-fielderr">
                  <Icon name="error" size={16} />
                  The two passwords don&apos;t match.
                </span>
              )}
            </div>
            <button type="submit" className="p-auth-button primary" disabled={busy} aria-busy={busy}>
              {busy ? 'Joining…' : 'Join'}
              <Icon name={busy ? 'progress_activity' : 'arrow_forward'} size={20} className={busy ? 'p-auth-spin' : undefined} />
            </button>
          </form>
        ) : (
          <div className="p-auth-form">
            <h1>Join the family</h1>
            <div className="p-auth-error" role="alert">
              <Icon name="error" />
              This invite link is missing its code. Ask a parent to send it again.
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
