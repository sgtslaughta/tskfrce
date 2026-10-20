import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Button, PasswordInput, TextInput } from '@mantine/core'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { StickerCard } from '@/v2/components/StickerCard'

/** Only same-site paths: "/devices" yes, "//evil.com" and "http://..." no. */
export const safeNext = (next: unknown): string =>
  typeof next === 'string' && /^\/(?![/\\])/.test(next) ? next : '/'

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
  }, [isAuthenticated, next, router])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login({ username: username.trim(), password })
      router.replace(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect username or password')
      setBusy(false)
    }
  }

  return (
    <main className="f-main" style={{ maxWidth: 440 }}>
      <StickerCard>
        <h1 className="f-display" style={{ marginTop: 0 }}>Welcome back</h1>
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
        <p>
          Are you a kid? <Link href="/kid">Go to your checklist</Link>
        </p>
      </StickerCard>
    </main>
  )
}
