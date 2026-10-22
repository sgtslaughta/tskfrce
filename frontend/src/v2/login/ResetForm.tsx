import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Button, PasswordInput } from '@mantine/core'
import { api } from '@/v2/api'
import { StickerCard } from '@/v2/components/StickerCard'

/** Set a new password from a parent's one-time reset link. */
export function ResetForm({ token }: { token: string | undefined }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
    <main className="f-main" style={{ maxWidth: 440 }}>
      <StickerCard>
        <h1 className="f-display" style={{ marginTop: 0 }}>Choose a new password</h1>
        {token ? (
          <form onSubmit={submit}>
            <PasswordInput
              label="New password"
              description="At least 8 characters."
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
            <PasswordInput
              mt="md"
              label="Type it again"
              autoComplete="new-password"
              value={again}
              onChange={(e) => setAgain(e.currentTarget.value)}
            />
            {error && <p role="alert">{error}</p>}
            <Button type="submit" mt="md" fullWidth loading={busy}>
              Save password
            </Button>
          </form>
        ) : (
          <p role="alert">This reset link is missing its code. Ask a parent to send it again.</p>
        )}
        <p>
          <Link href="/login">Back to log in</Link>
        </p>
      </StickerCard>
    </main>
  )
}
