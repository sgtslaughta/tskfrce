import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { api, ApiError } from '@/v2/api'
import type { Device, Kid, SetupStatus } from '@/v2/types'
import { markSetupDone } from '@/v2/components/RequireParent'
import { useSingleFlight } from '@/v2/hooks/useSingleFlight'
import { WizardFrame } from '@/v2/setup/WizardFrame'
import { StepFamily, detectTz } from '@/v2/setup/StepFamily'
import { StepParent, parentErrors, type ParentForm } from '@/v2/setup/StepParent'
import { StepKids } from '@/v2/setup/StepKids'
import { StepDevices } from '@/v2/setup/StepDevices'
import { StepChores } from '@/v2/setup/StepChores'
import { StepWindows } from '@/v2/setup/StepWindows'
import { StepRemote } from '@/v2/setup/StepRemote'
import { StepFinish } from '@/v2/setup/StepFinish'

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
  const once = useSingleFlight()
  const [family, setFamily] = useState({ name: '', tz: 'UTC' })
  useEffect(() => setFamily((f) => ({ ...f, tz: detectTz() })), []) // after mount: server renders UTC
  const [parent, setParent] = useState<ParentForm>({ username: '', password: '', fullName: '' })
  const [kids, setKids] = useState<Kid[]>([])
  const [chores, setChores] = useState<string[]>([])
  const [bedtime, setBedtime] = useState(false)
  const applied = useRef(new Set<string>())
  const choreIds = useRef(new Map<string, number>()) // created chores, so a retry only redoes the assignment

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
      markSetupDone(qc)
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
    mutationFn: async (jobs: { key: string; run: () => Promise<unknown> }[]) => {
      for (const j of jobs) {
        if (applied.current.has(j.key)) continue
        await j.run()
        applied.current.add(j.key)
      }
    },
    onSuccess: () => go(step + 1),
  })

  const go = (n: number) => {
    setTried(false)
    create.reset()
    apply.reset()
    setStep(n)
  }

  // one request per click even on a double-click; failures show via apply.error
  const run = (jobs: { key: string; run: () => Promise<unknown> }[]) =>
    void once(() => apply.mutateAsync(jobs).catch(() => {}))

  const next = () => {
    if (step === 1) {
      const e = parentErrors(parent)
      if (e.fullName || e.username || e.password) return setTried(true)
      return go(2)
    }
    // The family name goes in the same POST /setup that makes the account.
    if (step === 2) {
      if (loginFailed) return
      if (!family.name.trim()) return setTried(true)
      if (accountDone) return go(3)
      setConflict(false)
      return void once(() => create.mutateAsync().catch(() => {})) // errors show via create.error
    }
    if (step === 4) {
      return run(
        kids.length === 0
          ? []
          : chores.map((title) => ({
              key: `chore:${title}`,
              run: async () => {
                let id = choreIds.current.get(title)
                if (id === undefined) {
                  const c = await api<{ id: number }>('/chores/', {
                    method: 'POST',
                    body: { title, points: 10, needs_photo: false, steps: [] },
                  })
                  id = c.id
                  choreIds.current.set(title, id)
                }
                await api(`/chores/${id}/assignments`, {
                  method: 'POST',
                  body: {
                    kid_ids: kids.map((k) => k.id),
                    mode: 'each',
                    repeat: { type: 'daily', days: [] },
                    on_date: null,
                    due_time: null,
                  },
                })
              },
            })),
      )
    }
    if (step === 6) {
      return run(
        bedtime
          ? kids.map((k) => ({
              key: `window:${k.id}`,
              run: () =>
                api('/windows', {
                  method: 'POST',
                  body: { kind: 'allowed', days: '0123456', start: '07:00', end: '21:00', kid_id: k.id },
                }),
            }))
          : [],
      )
    }
    if (step > LAST) return void router.push('/')
    if (step === 3 && kidDraft.trim()) return setTried(true)
    go(step + 1)
  }

  const err = (create.error && !conflict ? create.error.message : null) ?? apply.error?.message

  const stepTitles = {
    1: { title: 'Make your parent account', sub: "You'll use this to log in. You can invite another parent later." },
    2: { title: 'Your family', sub: 'Shown on the kids\' screens and in notifications.' },
    3: { title: 'Add your kids', sub: 'Add each child. You can add more later from Kids & chores.' },
    4: { title: 'Pick some starter chores', sub: 'Tap to choose. Everything can be changed later.' },
    5: { title: 'Whose devices are these?', sub: 'Devices show up as the home box sees them on your Wi-Fi. Tap a kid to give it to them, or mark it Guest so it\'s never blocked.' },
    6: { title: 'When can devices be online?', sub: 'A starting schedule. Add holidays, summer and per-kid hours later in Settings.' },
    7: { title: 'Reach it from anywhere', sub: 'Approve chores when you\'re not home, using Tailscale (free, private).' },
  } as const

  const devices = (qc.getQueryData<Device[]>(['setup-devices']) ?? []).filter((d) => d.status !== 'unassigned').length
  const schedules = bedtime ? kids.length : 0

  return (
    <>
      <Head><title>Set up t@sk4ce</title></Head>
      <div className="f-shell" style={{ minHeight: '100vh' }}>
        <WizardFrame
          step={step}
          title={step > LAST ? 'You\'re all set' : stepTitles[step as keyof typeof stepTitles].title}
          subtitle={step > LAST ? 'Everything can be changed later in Settings.' : stepTitles[step as keyof typeof stepTitles].sub}
          onBack={step > 2 || (step === 2 && !accountDone) ? () => go(step - 1) : undefined}
          onNext={next}
          nextLabel={step > LAST ? 'Finish' : 'Next'}
          onSkip={step >= 3 && step <= LAST ? () => go(step + 1) : undefined}
          onStepClick={(n) => {
            if (n > step && n > step + 1) return // Can't skip ahead multiple steps
            go(n)
          }}
          busy={create.isPending || apply.isPending}
        >
          {step === 1 && <StepParent value={parent} showError={tried} onChange={setParent} />}
          {step === 2 && (
            <StepFamily name={family.name} tz={family.tz} showError={tried}
              onName={(name) => setFamily({ ...family, name })} onTz={(tz) => setFamily({ ...family, tz })} />
          )}
          {step === 2 && conflict && (
            <p role="alert">Setup is already done. <Link href="/login">Log in</Link> instead.</p>
          )}
          {step === 2 && loginFailed && (
            <p role="alert">Your account was created. <Link href="/login">Log in</Link> to continue.</p>
          )}
          {step === 3 && <StepKids kids={kids} name={kidDraft} onName={setKidDraft} onAdd={(k) => setKids([...kids, k])}
              draftError={tried && kidDraft.trim() ? `Add ${kidDraft.trim()} first or clear the field.` : undefined} />}
          {step === 4 && <StepChores selected={chores} hasKids={kids.length > 0} onChange={setChores} />}
          {step === 5 && <StepDevices kids={kids} />}
          {step === 6 && <StepWindows bedtime={bedtime} hasKids={kids.length > 0} onChange={setBedtime} />}
          {step === 7 && <StepRemote />}
          {step > LAST && <StepFinish kids={kids.length} chores={chores.length} devices={devices} schedules={schedules} />}
          {err && <p role="alert">Something went wrong: {err} Try again.</p>}
        </WizardFrame>
      </div>
    </>
  )
}
