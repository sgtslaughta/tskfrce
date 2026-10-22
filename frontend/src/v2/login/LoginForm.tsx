import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Button, PasswordInput, TextInput } from '@mantine/core'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { api } from '@/v2/api'
import type { SetupStatus } from '@/v2/types'
import { StickerCard } from '@/v2/components/StickerCard'

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
  const router = useRouter()
  const { login, isAuthenticated } = useUnifiedAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const next = safeNext(router.query?.next)

  useEffect(() => {
    if (isAuthenticated) router.replace(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, next])

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
      await login({ username: username.trim(), password }) // the effect above redirects
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect username or password')
      setBusy(false)
    }
  }

  return (
    <main className="f-main" style={{ maxWidth: 440 }}>
      <StickerCard>
        <h1 className="f-display" style={{ marginTop: 0 }}>Welcome back</h1>
        {router.query?.reset && <p role="status">Password saved. Log in with your new password.</p>}
        <form onSubmit={submit}>
          <TextInput
            label="Username"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
          />
          <PasswordInput
            mt="md"
            label="Password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          {error && <p role="alert">{error}</p>}
          <Button type="submit" mt="md" fullWidth loading={busy}>
            Log in
          </Button>
        </form>
        <p className="m-help">Forgot your password? Ask another parent for a reset link.</p>
        <p>
          Are you a kid? <Link href="/kid">Go to your checklist</Link>
        </p>
      </StickerCard>
    </main>
  )
}
