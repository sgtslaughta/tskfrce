import { useRouter } from 'next/router'
import { Button } from '@mantine/core'

interface Props {
  kids: number
  chores: number
  devices: number
  schedules: number
}

export function StepFinish({ kids, chores, devices, schedules }: Props) {
  const router = useRouter()

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ fontSize: '48px' }} aria-hidden="true"><span className="ms">celebration</span></div>
        <p style={{ marginBottom: '16px', fontSize: '14px' }}>
          {kids} {kids === 1 ? 'kid' : 'kids'}, {chores} {chores === 1 ? 'chore' : 'chores'},
          {devices} {devices === 1 ? 'device' : 'devices'}, {schedules} {schedules === 1 ? 'schedule' : 'schedules'}.
        </p>
      </div>
      <Button leftSection={<span className="ms" aria-hidden="true">home</span>} onClick={() => router.push('/')}>Go to Today</Button>
    </>
  )
}
