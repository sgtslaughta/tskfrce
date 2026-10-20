import Link from 'next/link'
import { FridgeShell } from '../components/FridgeShell'
import { Sticker } from '../components/Sticker'
import { StickerCard } from '../components/StickerCard'
import { useToday } from '../hooks/useToday'
import { KidCard } from './KidCard'
import { NewDevicesBanner } from './NewDevicesBanner'

const dayName = (iso?: string) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' }) : 'Today'

/** Parent home: day, pending approvals, new devices, one card per kid. */
export function TodayPage() {
  const { data, isError, error } = useToday()
  const n = data?.pending_approvals ?? 0
  const sticker = n > 0 && <Sticker>{`${n} ${n === 1 ? 'chore needs' : 'chores need'} you`}</Sticker>

  return (
    <FridgeShell title={dayName(data?.day)} actions={sticker || undefined}>
      {isError && <p role="alert">{(error as Error).message || 'Could not load today. Check your connection and try again.'}</p>}
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <NewDevicesBanner devices={data.new_devices} />
          {data.kids.length === 0 ? (
            <StickerCard>
              <p>Add your first kid to get started.</p>
              <Link href="/kids">Add a kid</Link>
            </StickerCard>
          ) : (
            data.kids.map((k) => <KidCard key={k.id} kid={k} />)
          )}
        </div>
      )}
    </FridgeShell>
  )
}
