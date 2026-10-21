import { Text } from '@mantine/core'
import { FridgeShell } from '@/v2/components/FridgeShell'
import { RequireParent } from '@/v2/components/RequireParent'
import { useKids } from '@/v2/hooks/useKids'
import { ChoreList } from './ChoreList'
import { KidEditor } from './KidEditor'
import { RewardsPanel } from './RewardsPanel'

function KidsBody() {
  const kids = useKids()
  return (
    <FridgeShell title="Kids & chores">
      {kids.isError && <Text role="alert">{kids.error.message}</Text>}
      {kids.data?.map((k) => (
        <section key={k.id} className="f-card" aria-label={k.full_name ?? k.username}>
          <h2 className="f-display">
            {k.avatar} {k.full_name ?? k.username}
          </h2>
          <KidEditor kid={k} />
          <ChoreList kidId={k.id} />
        </section>
      ))}
      <RewardsPanel />
      <h2 className="f-display">Add a kid</h2>
      <KidEditor />
    </FridgeShell>
  )
}

export function KidsPage() {
  return (
    <RequireParent>
      <KidsBody />
    </RequireParent>
  )
}
