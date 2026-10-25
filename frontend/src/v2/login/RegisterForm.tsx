import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/router'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { api } from '@/v2/api'
import { useLook } from '@/v2/parent/useLook'
import { Icon } from '@/v2/parent/Icon'
import { AuthBrand } from '@/v2/components/AuthBrand'

/** Username and expiry from the invite token (JWT `sub`, `exp`); display only, the server checks them itself. */
function readInvite(token: string | undefined): { name: string; hoursLeft: number } | null {
  try {
    const part = (token ?? '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { sub, exp } = JSON.parse(atob(part))
    return { name: String(sub), hoursLeft: Math.max(0, Math.round((exp * 1000 - Date.now()) / 3_600_000)) }
  } catch {
    return null
  }
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
  const invite = readInvite(token)
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
    <div className="p-auth-container">
      <AuthBrand />
      <div className="p-auth-form-side">
        {token ? (
          <form className="p-auth-form" onSubmit={submit}>
            <h3>Join the family</h3>
            {invite && (
              <div className="p-auth-invite">
                <div className="av">{invite.name.charAt(0).toUpperCase()}</div>
                <div>
                  <b>Invite for {invite.name}</b>
                  <small>Expires in {invite.hoursLeft} {invite.hoursLeft === 1 ? 'hour' : 'hours'}</small>
                </div>
              </div>
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
                  value={invite?.name ?? ''}
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
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
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
            <button type="submit" className="p-auth-button primary" disabled={busy}>
              Join
              <Icon name="arrow_forward" size={20} />
            </button>
          </form>
        ) : (
          <div className="p-auth-form">
            <h3>Join the family</h3>
            <div className="p-auth-error" role="alert">
              <Icon name="error" />
              This invite link is missing its code. Ask a parent to send it again.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
