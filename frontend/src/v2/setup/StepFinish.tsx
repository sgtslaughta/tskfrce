import { Button, Group } from '@mantine/core'

interface Props {
  kids: number
  chores: number
  devices: number
  schedules: number
}

export function StepFinish({ kids, chores, devices, schedules }: Props) {
  return (
    <>
      <div className="p-card" style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }} aria-hidden="true"><span className="ms">celebration</span></div>
        <p style={{ marginBottom: '16px', fontSize: '14px' }}>
          {kids} {kids === 1 ? 'kid' : 'kids'}, {chores} {chores === 1 ? 'chore' : 'chores'},
          {devices} {devices === 1 ? 'device' : 'devices'}, {schedules} {schedules === 1 ? 'schedule' : 'schedules'}.
          Locks start at the next lock time.
        </p>
      </div>
      <Group>
        <Button leftSection={<span className="ms" aria-hidden="true">home</span>}>Go to Today</Button>
        <Button variant="subtle" leftSection={<span className="ms" aria-hidden="true">notifications</span>}>Set up notifications</Button>
      </Group>
    </>
  )
}
