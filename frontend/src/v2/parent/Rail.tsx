import Link from 'next/link'
import { useRouter } from 'next/router'
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
        if (item.label === 'Bell') return <div key={idx} className="p-rail-bell"><Bell placement="rail" /></div>
        if (item.label === 'Log out')
          return (
            <button key={idx} type="button" className="p-rail-item" aria-label="Log out" onClick={onLogout}>
              <Icon name="logout" />
            </button>
          )

        return (
          <Link
            key={idx}
            href={item.href || ''}
            className="p-rail-item"
            aria-current={router.pathname === item.href ? 'page' : undefined}
            aria-label={item.label}
          >
            <Icon name={item.icon} />
            {item.dot && <span className="p-rail-dot" aria-hidden="true" />}
          </Link>
        )
      })}
    </nav>
  )
}
