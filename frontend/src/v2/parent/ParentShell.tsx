import { ReactNode } from 'react'
import { useRouter } from 'next/router'
import { useMediaQuery } from '@mantine/hooks'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { useLook } from './useLook'
import { Rail } from './Rail'
import { TabBar } from './TabBar'
import { ListDetail } from './ListDetail'
import { Bell } from '@/v2/components/Bell'
import { BlockerBanner } from '@/v2/components/BlockerBanner'
import { ChatDock } from '@/v2/chat/ChatDock'
import { cancelSignOut, startSignOut } from '@/v2/components/RequireParent'

export function ParentShell({
  title,
  list,
  children,
  actions,
}: {
  title: string
  list?: ReactNode
  children: ReactNode
  actions?: ReactNode
}) {
  const { logout, user } = useUnifiedAuth()
  const router = useRouter()
  const small = useMediaQuery('(max-width: 767px)')
  useLook('parent')

  const logOut = async () => {
    startSignOut()
    try {
      await logout()
    } catch {
      cancelSignOut()
      return
    }
    router.replace('/login')
  }

  if (list) {
    return (
      <div className="p-shell p-with-list">
        {!small && <Rail />}
        <ListDetail list={list} detail={children} listTitle={title} />
        {small && <TabBar />}
        <ChatDock meId={user ? Number(user.id) : null} />
      </div>
    )
  }

  return (
    <div className="p-shell">
      {!small && <Rail />}
      <div className="p-content">
        <header className="p-header">
          <h1>{title}</h1>
          {actions}
          <Bell placement="header" />
        </header>
        <BlockerBanner />
        <main className="p-main">{children}</main>
      </div>
      {small && <TabBar />}
      <ChatDock meId={user ? Number(user.id) : null} />
    </div>
  )
}
