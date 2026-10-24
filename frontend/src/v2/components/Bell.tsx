import { useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Button, Drawer, Popover } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useInbox, useMarkAllRead, useMarkRead, type InboxItem } from '../hooks/useInbox'
import { useApproveChore, useSendBack } from '../hooks/useToday'
import { useDecideRedemption } from '../hooks/useRewards'
import { Icon } from '../parent/Icon'

type FilterKind = 'all' | 'needs-you' | 'alerts'

const isNeedsYou = (n: InboxItem): boolean =>
  n.kind === 'chore_submitted' || n.kind === 'redemption_request'

const isAlert = (n: InboxItem): boolean =>
  n.kind === 'new_device' || n.kind === 'device_resisting'

const severityIcon = (n: InboxItem): { name: string; tone: 'hi' | 'md' | 'lv' | 'ok' } => {
  if (n.kind === 'device_resisting') return { name: 'gpp_maybe', tone: 'hi' }
  if (n.kind === 'new_device') return { name: 'device_unknown', tone: 'md' }
  if (n.kind === 'chore_submitted') return { name: 'school', tone: 'lv' }
  if (n.kind === 'redemption_request') return { name: 'redeem', tone: 'lv' }
  return { name: 'whatshot', tone: 'ok' }
}

const isToday = (iso: string): boolean => {
  const now = new Date()
  const then = new Date(iso)
  return (
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate()
  )
}

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return m < 1 ? 'now' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`
}

function List({ kid, onGo }: { kid: boolean; onGo: () => void }) {
  const router = useRouter()
  const inbox = useInbox(kid)
  const read = useMarkRead(kid)
  const readAll = useMarkAllRead(kid)
  const approve = useApproveChore()
  const sendBack = useSendBack()
  const decideRedemption = useDecideRedemption()
  const items = inbox.data?.items ?? []
  const [filter, setFilter] = useState<FilterKind>('all')

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (filter === 'needs-you') return isNeedsYou(n)
      if (filter === 'alerts') return isAlert(n)
      return true
    })
  }, [items, filter])

  const byGroup = useMemo(() => {
    const today: InboxItem[] = []
    const earlier: InboxItem[] = []
    filtered.forEach((n) => {
      if (isToday(n.created_at)) today.push(n)
      else earlier.push(n)
    })
    return { today, earlier }
  }, [filtered])

  const counts = useMemo(() => {
    const all = items.length
    const needsYou = items.filter(isNeedsYou).length
    const alerts = items.filter(isAlert).length
    return { all, needsYou, alerts }
  }, [items])

  const handleApprove = (n: InboxItem) => {
    if (!n.read) read.mutate(n.id)
    if (n.run_id) approve.mutate(n.run_id)
  }

  const handleSendBack = (n: InboxItem) => {
    if (!n.read) read.mutate(n.id)
    if (n.run_id) sendBack.mutate({ id: n.run_id, note: '' })
  }

  const handleDecline = (n: InboxItem) => {
    if (!n.read) read.mutate(n.id)
    if (n.redemption_id) decideRedemption.mutate({ id: n.redemption_id, approve: false })
  }

  const handleView = (n: InboxItem) => {
    if (!n.read) read.mutate(n.id)
    if (n.device_id) {
      onGo()
      router.push(`/devices?item=${n.device_id}`)
    }
  }

  return (
    <div className="p-bell-list">
      <div className="p-bell-head">
        <strong>Notifications</strong>
        {(inbox.data?.unread ?? 0) > 0 && (
          <button type="button" className="p-bell-mark-read" onClick={() => readAll.mutate(undefined)}>
            Mark all read
          </button>
        )}
      </div>
      <div className="p-bell-tabs">
        <button
          type="button"
          className={`p-bell-tab ${filter === 'all' ? 'on' : ''}`}
          onClick={() => setFilter('all')}
        >
          All · {counts.all}
        </button>
        <button
          type="button"
          className={`p-bell-tab ${filter === 'needs-you' ? 'on' : ''}`}
          onClick={() => setFilter('needs-you')}
        >
          Needs you · {counts.needsYou}
        </button>
        <button
          type="button"
          className={`p-bell-tab ${filter === 'alerts' ? 'on' : ''}`}
          onClick={() => setFilter('alerts')}
        >
          Alerts · {counts.alerts}
        </button>
      </div>
      {filtered.length === 0 ? (
        <p className="p-bell-empty">{inbox.isError ? "Can't load notifications right now." : "You're all caught up."}</p>
      ) : (
        <div className="p-bell-scroll">
          {byGroup.today.length > 0 && (
            <>
              <div className="p-bell-group">Today</div>
              {byGroup.today.map((n) => {
                const sev = severityIcon(n)
                return (
                  <div key={n.id} className={`p-bell-item ${!n.read ? 'unread' : ''}`}>
                    <div className={`p-bell-icon hi md lv ok`.split(' ').includes(sev.tone) ? `p-bell-icon ${sev.tone}` : 'p-bell-icon'}>
                      <Icon name={sev.name} />
                    </div>
                    <div className="p-bell-text">
                      <div className="p-bell-title">{n.title}</div>
                      {n.body && <div className="p-bell-sub">{n.body}</div>}
                    </div>
                    <div className="p-bell-actions">
                      {n.kind === 'chore_submitted' && (
                        <>
                          <button type="button" className="p-btn" onClick={() => handleApprove(n)}>
                            <Icon name="check" size={16} />
                            Approve
                          </button>
                          <button type="button" className="p-btn" onClick={() => handleSendBack(n)}>
                            <Icon name="undo" size={16} />
                            Send back
                          </button>
                        </>
                      )}
                      {n.kind === 'redemption_request' && (
                        <>
                          <button type="button" className="p-btn" onClick={() => handleApprove(n)}>
                            <Icon name="check" size={16} />
                            Approve
                          </button>
                          <button type="button" className="p-btn" onClick={() => handleDecline(n)}>
                            <Icon name="close" size={16} />
                            Decline
                          </button>
                        </>
                      )}
                      {n.kind === 'new_device' && (
                        <button type="button" className="p-btn" onClick={() => handleView(n)}>
                          <Icon name="person_add" size={16} />
                          Who's this?
                        </button>
                      )}
                      {n.kind === 'device_resisting' && (
                        <button type="button" className="p-btn" onClick={() => handleView(n)}>
                          <Icon name="devices" size={16} />
                          View
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}
          {byGroup.earlier.length > 0 && (
            <>
              <div className="p-bell-group">Earlier</div>
              {byGroup.earlier.map((n) => {
                const sev = severityIcon(n)
                return (
                  <div key={n.id} className="p-bell-item">
                    <div className={`p-bell-icon ${sev.tone}`}>
                      <Icon name={sev.name} />
                    </div>
                    <div className="p-bell-text">
                      <div className="p-bell-title">{n.title}</div>
                      {n.body && <div className="p-bell-sub">{n.body}</div>}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
      <div className="p-bell-footer">
        <span>
          <Icon name="tune" size={18} />
          Notification settings
        </span>
        <span>
          See all <Icon name="chevron_right" size={18} />
        </span>
      </div>
    </div>
  )
}

/** Notification bell: popover on desktop, full sheet under 768 px. `kid` uses the kid token. */
export function Bell({ kid = false, placement = 'header' }: { kid?: boolean; placement?: 'rail' | 'header' }) {
  const [opened, setOpened] = useState(false)
  const small = useMediaQuery('(max-width: 767px)')
  const unread = useInbox(kid).data?.unread ?? 0

  // On mobile, don't render bell for rail placement (header only)
  if (placement === 'rail' && small) {
    return null
  }

  const btn = (
    <button
      type="button"
      className={kid ? 'f-bell' : 'p-bell'}
      aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      onClick={() => setOpened((o) => !o)}
    >
      <Icon name="notifications" size={22} />
      {unread > 0 && <span className={kid ? 'f-bell-count' : 'p-bell-count'}>{unread > 9 ? '9+' : unread}</span>}
    </button>
  )
  const close = () => setOpened(false)
  if (small)
    return (
      <>
        {btn}
        <Drawer opened={opened} onClose={close} position="bottom" size="100%" title="Notifications">
          <List kid={kid} onGo={close} />
        </Drawer>
      </>
    )
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" width={400} shadow="md">
      <Popover.Target>{btn}</Popover.Target>
      <Popover.Dropdown className={kid ? 'f-bell-pop' : 'p-pop p-bell-pop'}>
        <List kid={kid} onGo={close} />
      </Popover.Dropdown>
    </Popover>
  )
}
