import { useRouter } from 'next/router'
import { Button } from '@mantine/core'

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** "3 kids, 4 chores, 4 devices, 2 schedules." (mockup 07 finish subtitle) */
export const finishSummary = (kids: number, chores: number, devices: number, schedules: number) =>
  `${n(kids, 'kid', 'kids')}, ${n(chores, 'chore', 'chores')}, ${n(devices, 'device', 'devices')}, ${n(schedules, 'schedule', 'schedules')}. Locks start at the next lock time.`

/** The two ways out of the wizard; the summary and tile live in the frame (done). */
export function StepFinish() {
  const router = useRouter()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      <Button variant="filled" leftSection={<span className="ms" aria-hidden="true">home</span>} onClick={() => router.push('/')}>Go to Today</Button>
      <Button
        variant="default"
        leftSection={<span className="ms" aria-hidden="true">notifications</span>}
        onClick={() => router.push('/settings?section=notifications')}
      >
        Set up notifications
      </Button>
    </div>
  )
}
