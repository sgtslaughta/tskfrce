import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Box, Burger, Button, Drawer } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useUnifiedAuth } from '@/contexts/UnifiedAuthContext'
import { ChatDock } from '@/v2/chat/ChatDock'
import { BlockerBanner } from './BlockerBanner'
import { Bell } from './Bell'
import { ColorSchemeToggle } from './ColorSchemeToggle'
import { cancelSignOut, startSignOut } from './RequireParent'

export const NAV = [
  { href: '/', label: 'Today' },
  { href: '/devices', label: 'Devices' },
  { href: '/kids', label: 'Kids & chores' },
  { href: '/settings', label: 'Settings' },
] as const

function Nav({ current, drawer }: { current: string; drawer?: boolean }) {
  return (
    <nav aria-label="Main" className={drawer ? 'f-nav f-nav-drawer' : 'f-nav'}>
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} aria-current={current === n.href ? 'page' : undefined}>
          {n.label}
        </Link>
      ))}
    </nav>
  )
}

/** Parent page frame: top bar (wordmark, day, nav, toggle, log out) and a titled main column. */
export function FridgeShell({
  title,
  children,
  actions,
}: {
  title: string
  children: ReactNode
  actions?: ReactNode
}) {
  const router = useRouter()
  const { logout, user } = useUnifiedAuth()
  const [open, { toggle, close }] = useDisclosure(false)
  // set after mount: server and browser time zones can differ
  const [day, setDay] = useState('')
  useEffect(() => setDay(new Date().toLocaleDateString(undefined, { weekday: 'long' })), [])

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

  return (
    <div className="f-shell">
      <header className="f-bar">
        <Burger hiddenFrom="md" opened={open} onClick={toggle} aria-label={open ? 'Close menu' : 'Open menu'} />
        <Link href="/" className="f-wordmark">
          t@sk4ce
        </Link>
        <span className="f-day">{day}</span>
        <Box visibleFrom="md" style={{ flex: 1 }}>
          <Nav current={router.pathname} />
        </Box>
        <Box hiddenFrom="md" style={{ flex: 1 }} />
        <Bell />
        <ColorSchemeToggle />
        <Button
          component="a"
          href="https://sgtslaughta.github.io/tskfrce/?from=app"
          variant="subtle"
          visibleFrom="xs"
          title="Help and documentation"
        >
          ?
        </Button>
        <Button variant="default" onClick={logOut} visibleFrom="xs">
          Log out
        </Button>
      </header>
      <Drawer opened={open} onClose={close} title="t@sk4ce" size="xs" hiddenFrom="md">
        <Nav current={router.pathname} drawer />
        <Button variant="default" mt="md" fullWidth onClick={logOut}>
          Log out
        </Button>
      </Drawer>
      <main className="f-main">
        <div className="f-title-row">
          <h1>{title}</h1>
          {actions}
        </div>
        <BlockerBanner />
        {children}
      </main>
      <ChatDock meId={user ? Number(user.id) : null} />
    </div>
  )
}
