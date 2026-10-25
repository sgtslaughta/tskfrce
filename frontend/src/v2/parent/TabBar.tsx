import Link from 'next/link'
import { useRouter } from 'next/router'
import { useThreads } from '@/v2/hooks/useChat'
import { Icon } from './Icon'

interface TabItem {
  href: string
  label: string
  icon: string
  badge?: number
}

export function TabBar() {
  const router = useRouter()
  const threads = useThreads()
  const unread = threads.data?.total ?? 0

  const items: TabItem[] = [
    { href: '/', label: 'Today', icon: 'home' },
    { href: '/devices', label: 'Devices', icon: 'devices' },
    { href: '/kids', label: 'Kids', icon: 'group' },
    { href: '/chat', label: 'Chat', icon: 'forum', badge: unread > 0 ? unread : undefined },
    { href: '/more', label: 'More', icon: 'more_vert' },
  ]

  return (
    <nav aria-label="Main" className="p-tabbar">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="p-tabbar-item"
          aria-current={router.pathname === item.href ? 'page' : undefined}
          aria-label={item.label}
          role="tab"
          aria-selected={router.pathname === item.href}
        >
          <Icon name={item.icon} />
          {item.badge && <span className="p-tabbar-badge">{item.badge > 9 ? '9+' : item.badge}</span>}
          <span className="p-tabbar-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
