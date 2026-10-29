import { useRouter } from 'next/router'
import { RequireParent } from '@/v2/components/RequireParent'
import { ParentShell } from '@/v2/parent/ParentShell'
import { MorePage as MorePageContent } from '@/v2/parent/MorePage'
import { cancelSignOut, startSignOut } from '@/v2/components/RequireParent'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'

export default function MorePage() {
  const router = useRouter()
  const { logout } = useUnifiedAuth()

  const handleLogout = async () => {
    startSignOut()
    try {
      await logout()
    } catch {
      cancelSignOut()
      return
    }
    router.replace('/login')
  }

  return (
    <RequireParent>
      <ParentShell title="More">
        <MorePageContent onLogout={handleLogout} />
      </ParentShell>
    </RequireParent>
  )
}
