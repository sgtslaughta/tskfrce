import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { api, ApiError } from '@/v2/api'
import type { Device, HourRule, HoursPayload, Kid, RuleBody, SetupStatus } from '@/v2/types'
import { markSetupDone, STEP_KEY } from '@/v2/components/RequireParent'
import { SetupResuming } from '@/v2/parent/states'
import { LAST, saveStep } from '@/v2/setup/setupStep'
import { useSingleFlight } from '@/v2/hooks/useSingleFlight'
import { useLook } from '@/v2/parent/useLook'
import { WizardFrame } from '@/v2/setup/WizardFrame'
import { StepFamily, detectTz } from '@/v2/setup/StepFamily'
import { StepParent, parentErrors, type ParentForm } from '@/v2/setup/StepParent'
import { StepKids } from '@/v2/setup/StepKids'
import { StepDevices } from '@/v2/setup/StepDevices'
import { StepChores } from '@/v2/setup/StepChores'
import { starter } from '@/v2/setup/starterChores'
import { DEFAULT_DRAFTS, StepHours } from '@/v2/setup/StepHours'
import { StepRemote } from '@/v2/setup/StepRemote'
import { finishSummary, StepFinish } from '@/v2/setup/StepFinish'

export default function SetupPage() {
  useLook('parent')
  const router = useRouter()
  const qc = useQueryClient()
  const { loginWithToken, isInitialized, isAuthenticated } = useUnifiedAuth()
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
  const [parent, setParent] = useState<ParentForm>({ username: '', password: '', again: '', fullName: '' })
  const [kids, setKids] = useState<Kid[]>([])
  const [chores, setChores] = useState<string[]>([])
  const [hours, setHours] = useState<RuleBody[]>(DEFAULT_DRAFTS)
  const [choresLock, setChoresLock] = useState(true)
  const applied = useRef(new Set<string>())
  const choreIds = useRef(new Map<string, number>()) // created chores, so a retry only redoes the assignment

  // Already set up (and not by us a moment ago): a parent who never reached Finish resumes; anyone else logs in.
  const status = useQuery({ queryKey: ['setup'], queryFn: () => api<SetupStatus>('/setup'), staleTime: Infinity })
  const returning = status.data?.needed === false && !justCreated.current
  const resume = useQuery({
    queryKey: STEP_KEY,
    queryFn: () => api<{ step: number | null }>('/setup/step'),
    enabled: returning && !!isInitialized && !!isAuthenticated,
    staleTime: 0,
    retry: false,
  })
  const resumeAt = typeof resume.data?.step === 'number' ? resume.data.step : null
  useEffect(() => {
    if (!returning || isInitialized === false || (isAuthenticated && resume.isPending)) return
    if (resumeAt === null) router.replace('/login')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.data, isInitialized, isAuthenticated, resume.isPending, resumeAt])
  useEffect(() => {
    if (resumeAt === null || accountDone) return
    setAccountDone(true)
    setStep(resumeAt)
    api<Kid[]>('/kids').then(setKids).catch(() => {}) // the wizard forgot them; steps 4-5 need them
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeAt])

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
    if (justCreated.current || accountDone) saveStep(qc, n)
  }

  // one request per click even on a double-click; failures show via apply.error
  // built-in chore types, fetched once when the first starter chore is created
  const typesRef = useRef<Promise<{ id: number; name: string }[]> | null>(null)
  const choreTypes = () =>
    (typesRef.current ??= api<unknown>('/chore-types')
      .then((r) => (Array.isArray(r) ? (r as { id: number; name: string }[]) : []))
      .catch(() => []))

  const run = (jobs: { key: string; run: () => Promise<unknown> }[]) =>
    void once(() => apply.mutateAsync(jobs).catch(() => {}))

  const next = () => {
    if (step === 1) {
      const e = parentErrors(parent)
      if (e.fullName || e.username || e.password || e.again) return setTried(true)
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
                  const st = starter(title)
                  const types = await choreTypes()
                  const typeId = types.find((t) => t.name === st?.type)?.id
                  const c = await api<{ id: number }>('/chores/', {
                    method: 'POST',
                    body: { title, points: st?.points ?? 10, needs_photo: false, steps: [], ...(typeId ? { type_id: typeId } : {}) },
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
      return run([
        ...hours.map((body, i) => ({
          key: `rule:${i}`,
          run: async () => {
            const have = await api<HoursPayload>('/hours') // an earlier try must not duplicate an identical rule
            const same = (r: HourRule) => r.name === body.name && r.category === body.category && r.kind === body.kind && r.days === body.days && r.everyone === body.everyone && r.start_date === body.start_date && r.end_date === body.end_date && JSON.stringify(r.times.map((t) => [t.start, t.end])) === JSON.stringify(body.times.map((t) => [t.start, t.end]))
            if (!have?.rules?.some(same)) await api('/hours', { method: 'POST', body })
          },
        })),
        { key: `chores_lock:${choresLock}`, run: () => api('/family', { method: 'PATCH', body: { chores_lock: choresLock } }) },
      ])
    }
    if (step > LAST) return
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
  const schedules = Array.from(applied.current).filter((k) => k.startsWith('rule:')).length

  if (returning && !accountDone)
    return (
      <main className="p-guard-state">{resumeAt !== null && <SetupResuming step={resumeAt} />}</main>
    )

  return (
    <>
      <Head><title>Set up t@sk4ce</title></Head>
      <div className="f-shell" style={{ minHeight: '100vh' }}>
        <WizardFrame
          step={step}
          title={step > LAST ? 'You\'re all set' : stepTitles[step as keyof typeof stepTitles].title}
          subtitle={step > LAST ? finishSummary(kids.length, chores.length, devices, schedules) : stepTitles[step as keyof typeof stepTitles].sub}
          onBack={step > 2 || (step === 2 && !accountDone) ? () => go(step - 1) : undefined}
          onNext={next}
          nextLabel={step === LAST ? 'Finish' : 'Next'}
          onSkip={step >= 3 && step <= LAST ? () => go(step + 1) : undefined}
          onStepClick={(n) => {
            if (n > step && n > step + 1) return // Can't skip ahead multiple steps
            go(n)
          }}
          busy={create.isPending || apply.isPending}
          done={step > LAST}
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
          {step === 6 && <StepHours drafts={hours} onChange={setHours} choresLock={choresLock} onChoresLock={setChoresLock} />}
          {step === 7 && <StepRemote />}
          {step > LAST && <StepFinish />}
          {err && <p role="alert">Something went wrong: {err} Try again.</p>}
        </WizardFrame>
      </div>
    </>
  )
}
