import type { ChangeEvent } from 'react'
import { PasswordInput, TextInput } from '@mantine/core'

export interface ParentForm { username: string; password: string; again: string; fullName: string }

export const parentErrors = (p: ParentForm) => ({
  fullName: p.fullName.trim() ? undefined : 'Enter your name.',
  username: /^[a-zA-Z0-9_.-]{3,50}$/.test(p.username)
    ? undefined
    : 'Use 3 or more letters, numbers, dots, dashes or underscores.',
  password: p.password.length >= 8 ? undefined : 'Use at least 8 characters.',
  again: p.again === p.password ? undefined : "The two passwords don't match.",
})

interface Props {
  value: ParentForm
  showError: boolean
  onChange: (v: ParentForm) => void
}

export function StepParent({ value, showError, onChange }: Props) {
  const err = parentErrors(value)
  const set = (k: keyof ParentForm) => (e: ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.currentTarget.value })
  return (
    <>
      <TextInput label="Your name" value={value.fullName} onChange={set('fullName')} error={showError ? err.fullName : undefined} />
      <TextInput mt="md" label="Username" value={value.username} onChange={set('username')} autoComplete="username"
        error={showError ? err.username : undefined} />
      <PasswordInput mt="md" label="Password" value={value.password} onChange={set('password')} autoComplete="new-password"
        description="At least 8 characters." error={showError ? err.password : undefined} />
      <PasswordInput mt="md" label="Type it again" value={value.again} onChange={set('again')} autoComplete="new-password"
        error={showError || value.again ? err.again : undefined} />
    </>
  )
}
