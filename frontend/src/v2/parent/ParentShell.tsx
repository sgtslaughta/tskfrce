import { ReactNode } from 'react'
import Link from 'next/link'
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
  phone,
}: {
  title: string
  /** phone only: shown instead of the list (e.g. Today's avatar strip above the day) */
  phone?: ReactNode
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

  // phone: the Chat tab replaces the floating chat button
  const dock = small ? null : <ChatDock meId={user ? Number(user.id) : null} />
  const initial = (user?.username ?? '?').charAt(0).toUpperCase()
  const phoneTools = (
    <>
      <Bell placement="header" />
      <Link href="/more" className="p-head-me" aria-label="Account and settings">
        {initial}
      </Link>
    </>
  )

  if (list) {
    return (
      <div className="p-shell p-with-list">
        {!small && <Rail onLogout={logOut} />}
        <div className="p-content">
          {small && (
            <header className="p-header">
              <h1>{title}</h1>
              {phoneTools}
            </header>
          )}
          <BlockerBanner />
          <ListDetail list={list} detail={children} listTitle={title} phone={phone} />
        </div>
        {small && <TabBar />}
        {dock}
      </div>
    )
  }

  return (
    <div className="p-shell">
      {!small && <Rail onLogout={logOut} />}
      <div className="p-content">
        <header className="p-header">
          <h1>{title}</h1>
          {actions}
          {small && phoneTools}
        </header>
        <BlockerBanner />
        <main className="p-main">{children}</main>
      </div>
      {small && <TabBar />}
      {dock}
    </div>
  )
}
