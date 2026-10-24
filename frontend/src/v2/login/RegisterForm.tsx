import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/router'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { api } from '@/v2/api'
import { useLook } from '@/v2/parent/useLook'
import { Icon } from '@/v2/parent/Icon'
import { AuthBrand } from '@/v2/components/AuthBrand'

/** Redeem a parent's invite link. The username comes from the invite itself. */
export function RegisterForm({ token }: { token: string | undefined }) {
  useLook('parent')
  const router = useRouter()
  const { login } = useUnifiedAuth()
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
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
                  value={username}
                  onChange={(e) => setUsername(e.currentTarget.value)}
                  placeholder="Username"
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
                  className="p-auth-link"
                  style={{ textDecoration: 'none' }}
                >
                  <Icon name={showPassword ? 'visibility' : 'visibility_off'} />
                </button>
              </div>
            </div>
            <div className="p-auth-strength">
              {[...Array(4)].map((_, i) => (
                <i key={i} className={i < strength ? 'on' : ''} />
              ))}
            </div>
            <button type="submit" className="p-auth-button primary" disabled={busy}>
              Create account
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
