import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/router'
import { Button, PasswordInput, TextInput } from '@mantine/core'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { api } from '@/v2/api'
import { StickerCard } from '@/v2/components/StickerCard'

/** Redeem a parent's invite link. The username comes from the invite itself. */
export function RegisterForm({ token }: { token: string | undefined }) {
  const router = useRouter()
  const { login } = useUnifiedAuth()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
    <main className="f-main" style={{ maxWidth: 440 }}>
      <StickerCard>
        <h1 className="f-display" style={{ marginTop: 0 }}>Join the family</h1>
        {token ? (
          <form onSubmit={submit}>
            <TextInput label="Your name" value={fullName} onChange={(e) => setFullName(e.currentTarget.value)} />
            <PasswordInput
              mt="md"
              label="Choose a password"
              description="At least 8 characters."
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
            {error && <p role="alert">{error}</p>}
            <Button type="submit" mt="md" fullWidth loading={busy}>
              Create account
            </Button>
          </form>
        ) : (
          <p role="alert">This invite link is missing its code. Ask a parent to send it again.</p>
        )}
      </StickerCard>
    </main>
  )
}
