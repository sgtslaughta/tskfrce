import Link from 'next/link'
import { useRouter } from 'next/router'
import { Tooltip } from '@mantine/core'
import { useThreads } from '@/v2/hooks/useChat'
import { Bell } from '@/v2/components/Bell'
import { Icon } from './Icon'

interface RailItem {
  icon: string
  href?: string
  label: string
  dot?: boolean
}

export function Rail({ onLogout }: { onLogout?: () => void }) {
  const router = useRouter()
  const threads = useThreads()
  const unread = threads.data?.total ?? 0

  const items: RailItem[] = [
    { icon: '@', label: 'Logo' }, // Logo placeholder
    { icon: 'notifications', label: 'Bell' }, // Bell with separate placement
    { icon: 'home', href: '/', label: 'Today' },
    { icon: 'devices', href: '/devices', label: 'Devices' },
    { icon: 'group', href: '/kids', label: 'Kids & chores' },
    { icon: 'forum', href: '/chat', label: 'Chat', dot: unread > 0 },
    { icon: 'spacer', label: 'Spacer' },
    { icon: 'settings', href: '/settings', label: 'Settings' },
    { icon: 'logout', label: 'Log out' },
  ]

  return (
    <nav aria-label="Main" className="p-rail" role="navigation">
      {items.map((item, idx) => {
        if (item.label === 'Spacer') return <div key={idx} className="p-rail-spacer" />
        if (item.label === 'Logo')
          return (
            <Link key={idx} href="/" className="p-rail-logo" aria-label="t@sk4ce">
              @
            </Link>
          )
        if (item.label === 'Bell')
          return (
            <div key={idx} className="p-rail-bell">
              <Tooltip label="Notifications" position="right" withArrow openDelay={400} closeDelay={100}>
                <Bell placement="rail" />
              </Tooltip>
            </div>
          )
        if (item.label === 'Log out')
          return (
            <Tooltip key={idx} label={item.label} position="right" withArrow openDelay={400} closeDelay={100}>
              <button type="button" className="p-rail-item" aria-label={item.label} onClick={onLogout}>
                <Icon name="logout" />
              </button>
            </Tooltip>
          )

        return (
          <Tooltip key={idx} label={item.label} position="right" withArrow openDelay={400} closeDelay={100}>
            <Link
              href={item.href || ''}
              className="p-rail-item"
              aria-current={router.pathname === item.href ? 'page' : undefined}
              aria-label={item.label}
            >
              <Icon name={item.icon} />
              {item.dot && <span className="p-rail-dot" aria-hidden="true" />}
            </Link>
          </Tooltip>
        )
      })}
    </nav>
  )
}
