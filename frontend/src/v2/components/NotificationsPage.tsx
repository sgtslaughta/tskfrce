import { ParentShell } from '@/v2/parent/ParentShell'
import { RequireParent } from './RequireParent'
import { List } from './Bell'

/** See all: the bell's list, full width (§3.7). */
export function NotificationsPage() {
  return (
    <RequireParent>
      <ParentShell title="Notifications">
        <List onGo={() => {}} page />
      </ParentShell>
    </RequireParent>
  )
}
