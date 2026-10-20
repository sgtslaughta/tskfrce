import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { api, ApiError } from '@/v2/api'
import type { Kid, SetupStatus } from '@/v2/types'
import { WizardFrame } from '@/v2/setup/WizardFrame'
import { StepFamily, detectTz } from '@/v2/setup/StepFamily'
import { StepParent, parentErrors, type ParentForm } from '@/v2/setup/StepParent'
import { StepKids } from '@/v2/setup/StepKids'
import { StepDevices } from '@/v2/setup/StepDevices'
import { StepChores } from '@/v2/setup/StepChores'
import { StepWindows } from '@/v2/setup/StepWindows'
import { StepRemote } from '@/v2/setup/StepRemote'

const LAST = 7

export default function SetupPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { loginWithToken } = useUnifiedAuth()
  const [step, setStep] = useState(1)
  const [tried, setTried] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [accountDone, setAccountDone] = useState(false)
  const [loginFailed, setLoginFailed] = useState(false)
  const [kidDraft, setKidDraft] = useState('')
  const justCreated = useRef(false)
  const [family, setFamily] = useState({ name: '', tz: detectTz() })
  const [parent, setParent] = useState<ParentForm>({ username: '', password: '', fullName: '' })
  const [kids, setKids] = useState<Kid[]>([])
  const [chores, setChores] = useState<string[]>([])
  const [bedtime, setBedtime] = useState(false)
  const applied = useRef(new Set<string>())

  // Already set up (and not by us a moment ago): go log in.
  const status = useQuery({ queryKey: ['setup'], queryFn: () => api<SetupStatus>('/setup'), staleTime: Infinity })
  useEffect(() => {
    if (status.data?.needed === false && !justCreated.current) router.replace('/login')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.data])

  const create = useMutation({
    mutationFn: async () => {
      const r = await api<{ access_token: string; refresh_token: string; expires_in: number }>('/setup', {
        method: 'POST',
        body: {
          family_name: family.name.trim(),
          timezone: family.tz,
          parent: { username: parent.username, password: parent.password, full_name: parent.fullName.trim() },
        },
      })
      // The account exists from here on. Never POST /setup again, even if logging in fails.
      justCreated.current = true
      setAccountDone(true)
      qc.setQueryData(['setup'], { needed: false })
      try {
        await loginWithToken(r.access_token, r.refresh_token, r.expires_in)
        return true
      } catch {
        return false
      }
    },
    onSuccess: (loggedIn) => {
      setTried(false)
      if (loggedIn) setStep(3)
      else setLoginFailed(true)
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) setConflict(true)
    },
  })

  /** POST each not-yet-applied request; remember successes so Back/Next never duplicates. */
  const apply = useMutation({
    mutationFn: async (jobs: { key: string; path: string; body: unknown }[]) => {
      for (const j of jobs) {
        if (applied.current.has(j.key)) continue
        await api(j.path, { method: 'POST', body: j.body })
        applied.current.add(j.key)
      }
    },
    onSuccess: () => go(step + 1),
  })

  const go = (n: number) => {
    create.reset()
    apply.reset()
    setStep(n)
  }

  const next = () => {
    if (step === 1) {
      if (!family.name.trim()) return setTried(true)
      return go(2)
    }
    if (step === 2) {
      if (loginFailed) return
      if (accountDone) return go(3)
      const e = parentErrors(parent)
      if (e.fullName || e.username || e.password) return setTried(true)
      setConflict(false)
      return create.mutate()
    }
    if (step === 5) {
      return apply.mutate(
        kids.flatMap((k) =>
          chores.map((title) => ({
            key: `chore:${k.id}:${title}`,
            path: '/chores/',
            body: { title, kid_id: k.id, points: 10, repeat: { type: 'daily', days: [] } },
          })),
        ),
      )
    }
    if (step === 6) {
      return apply.mutate(
        bedtime
          ? kids.map((k) => ({
              key: `window:${k.id}`,
              path: '/windows',
              body: { kind: 'allowed', days: '0123456', start: '07:00', end: '21:00', kid_id: k.id },
            }))
          : [],
      )
    }
    if (step === LAST) return void router.push('/')
    if (step === 3 && kidDraft.trim()) return setTried(true)
    go(step + 1)
  }

  const err = (create.error && !conflict ? create.error.message : null) ?? apply.error?.message

  return (
    <>
      <Head><title>Set up t@sk4ce</title></Head>
      <div className="f-shell" style={{ minHeight: '100vh' }}>
        <WizardFrame
          step={step}
          onBack={step > 2 ? () => go(step - 1) : undefined}
          onNext={next}
          nextLabel={step === LAST ? 'Finish' : 'Next'}
          onSkip={step >= 3 && step < LAST ? () => go(step + 1) : undefined}
          busy={create.isPending || apply.isPending}
        >
          {step === 1 && (
            <StepFamily name={family.name} tz={family.tz} showError={tried}
              onName={(name) => setFamily({ ...family, name })} onTz={(tz) => setFamily({ ...family, tz })} />
          )}
          {step === 2 && <StepParent value={parent} showError={tried} conflict={conflict} onChange={setParent} />}
          {step === 2 && loginFailed && (
            <p role="alert">Your account was created. <Link href="/login">Log in</Link> to continue.</p>
          )}
          {step === 3 && <StepKids kids={kids} name={kidDraft} onName={setKidDraft} onAdd={(k) => setKids([...kids, k])}
              draftError={tried && kidDraft.trim() ? `Add ${kidDraft.trim()} first or clear the box.` : undefined} />}
          {step === 4 && <StepDevices kids={kids} />}
          {step === 5 && <StepChores selected={chores} hasKids={kids.length > 0} onChange={setChores} />}
          {step === 6 && <StepWindows bedtime={bedtime} hasKids={kids.length > 0} onChange={setBedtime} />}
          {step === 7 && <StepRemote />}
          {err && <p role="alert">Something went wrong: {err} Try again.</p>}
        </WizardFrame>
      </div>
    </>
  )
}
