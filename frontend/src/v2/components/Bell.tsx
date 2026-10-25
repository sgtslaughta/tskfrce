import { useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState, ErrorPanel } from '@/v2/parent/states'
import { useRouter } from 'next/router'
import { Drawer, Popover, Tooltip } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { useMediaQuery } from '@mantine/hooks'
import { useInbox, useMarkAllRead, useMarkRead, type Inbox, type InboxItem } from '../hooks/useInbox'
import { useApproveChore, useSendBack, useToday } from '../hooks/useToday'
import { useDecideRedemption } from '../hooks/useRewards'
import { Icon } from '../parent/Icon'
import { toastFail, toastOk } from '../notify'
import { api } from '../api'

type FilterKind = 'all' | 'needs-you' | 'alerts'

/** Chore runs and redemptions still waiting on a parent (a stale notification gets no buttons). */
type Pending = { runs: Set<number>; redemptions: Set<number> }

const isNeedsYou = (n: InboxItem, p: Pending): boolean =>
  (n.kind === 'chore_submitted' && !!n.run_id && p.runs.has(n.run_id)) ||
  (n.kind === 'redemption_request' && !!n.redemption_id && p.redemptions.has(n.redemption_id))

const isAlert = (n: InboxItem): boolean =>
  n.kind === 'new_device' || n.kind === 'device_resisting'

const severityIcon = (n: InboxItem): { name: string; tone: 'hi' | 'md' | 'lv' | 'ok' } => {
  if (n.kind === 'device_resisting') return { name: 'gpp_maybe', tone: 'hi' }
  if (n.kind === 'new_device') return { name: 'device_unknown', tone: 'md' }
  if (n.kind === 'chore_submitted') return { name: 'school', tone: 'lv' }
  if (n.kind === 'redemption_request') return { name: 'redeem', tone: 'lv' }
  return { name: 'whatshot', tone: 'ok' }
}

/** Where a parent notification leads: the device, the chore on Today, or the Needs you list. */
const dest = (n: InboxItem): string | null =>
  n.device_id
    ? `/devices?item=${n.device_id}`
    : n.run_id
      ? `/?chore=${n.run_id}`
      : n.kind === 'redemption_request'
        ? '/?tab=needs'
        : null

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

function List({ kid, onGo, sheet }: { kid: boolean; onGo: () => void; sheet?: boolean }) {
  const router = useRouter()
  const inbox = useInbox(kid)
  const read = useMarkRead(kid)
  const readAll = useMarkAllRead(kid)
  const approve = useApproveChore()
  const sendBack = useSendBack()
  const decideRedemption = useDecideRedemption()
  const today = useToday(!kid).data
  const pending = useMemo<Pending>(() => {
    const needs = today?.needs_you ?? []
    return {
      runs: new Set(needs.filter((i) => i.type === 'chore' || i.type === 'redo').map((i) => i.id)),
      redemptions: new Set(needs.filter((i) => i.type === 'reward' || i.type === 'screen_time').map((i) => i.id)),
    }
  }, [today?.needs_you])
  // the server sends the newest page; "Show older" appends further pages (the 30 s poll only refreshes the first)
  const [older, setOlder] = useState<{ items: InboxItem[]; more: boolean } | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const items = useMemo(() => {
    const first = inbox.data?.items ?? []
    const seen = new Set(first.map((i) => i.id))
    return older ? [...first, ...older.items.filter((i) => !seen.has(i.id))] : first
  }, [inbox.data?.items, older])
  const hasMore = older ? older.more : !!inbox.data?.has_more
  const showOlder = async () => {
    const last = items.at(-1)
    if (!last || loadingOlder) return
    setLoadingOlder(true)
    try {
      const page = await api<Inbox>(`/notifications?before=${last.id}`, { kid })
      setOlder({ items: [...(older?.items ?? []), ...page.items], more: page.has_more })
    } catch (e) {
      toastFail(e)
    } finally {
      setLoadingOlder(false)
    }
  }
  const more = hasMore ? '+' : ''
  const [filter, setFilter] = useState<FilterKind>('all')
  const [sending, setSending] = useState<number | null>(null)
  const [note, setNote] = useState('')

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (filter === 'needs-you') return isNeedsYou(n, pending)
      if (filter === 'alerts') return isAlert(n)
      return true
    })
  }, [items, filter, pending])

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
    const needsYou = items.filter((n) => isNeedsYou(n, pending)).length
    const alerts = items.filter(isAlert).length
    return { all, needsYou, alerts }
  }, [items, pending])

  // one request per notification at a time (a double click or Enter-mash must not send twice)
  const qc = useQueryClient()
  const inflight = useRef(new Set<number>())
  const [busy, setBusy] = useState<number | null>(null)
  const act = (n: InboxItem, go: () => Promise<unknown>, ok: string) => {
    if (inflight.current.has(n.id)) return Promise.resolve(false)
    inflight.current.add(n.id)
    setBusy(n.id)
    return go()
      .then(() => (toastOk(ok), true), (e) => (toastFail(e), qc.invalidateQueries({ queryKey: ['today'] }), false))
      .finally(() => (inflight.current.delete(n.id), setBusy((b) => (b === n.id ? null : b))))
  }
  const markRead = (n: InboxItem) => { if (!n.read) read.mutate(n.id) }

  const handleApprove = (n: InboxItem) => {
    if (n.run_id) void act(n, () => approve.mutateAsync(n.run_id!), 'Approved').then((ok) => ok && markRead(n))
  }

  /** The note box stays open (with its text) when the request fails. */
  const handleSendBack = async (n: InboxItem) => {
    if (!n.run_id || !note.trim()) return
    const ok = await act(n, () => sendBack.mutateAsync({ id: n.run_id!, note: note.trim() }), 'Sent back')
    if (!ok) return
    markRead(n)
    setSending(null)
    setNote('')
  }

  const handleDecide = (n: InboxItem, yes: boolean) => {
    if (n.redemption_id)
      void act(n, () => decideRedemption.mutateAsync({ id: n.redemption_id!, approve: yes }), yes ? 'Approved' : 'Declined').then((ok) => ok && markRead(n))
  }
  const handleRedeem = (n: InboxItem) => handleDecide(n, true)
  const handleDecline = (n: InboxItem) => handleDecide(n, false)

  /** Click a notification: mark it read and go where it points (kid notifications just get read). */
  const go = (n: InboxItem) => {
    markRead(n)
    const to = kid ? null : dest(n)
    if (!to) return
    onGo()
    void router.push(to)
  }
  const text = (n: InboxItem) => (
    <button type="button" className="p-bell-text" onClick={() => go(n)}>
      <span className="p-bell-title">{n.title}</span>
      {n.body && <span className="p-bell-sub">{n.body}</span>}
    </button>
  )

  const handleView = (n: InboxItem) => {
    if (!n.read) read.mutate(n.id)
    if (n.device_id) {
      onGo()
      router.push(`/devices?item=${n.device_id}`)
    }
  }

  return (
    <div className="p-bell-list" data-sheet={sheet || undefined}>
      <div className="p-bell-head">
        {sheet ? <span /> : <strong>Notifications</strong>}
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
          All · {counts.all}{more}
        </button>
        <button
          type="button"
          className={`p-bell-tab ${filter === 'needs-you' ? 'on' : ''}`}
          onClick={() => setFilter('needs-you')}
        >
          Needs you · {counts.needsYou}{more}
        </button>
        <button
          type="button"
          className={`p-bell-tab ${filter === 'alerts' ? 'on' : ''}`}
          onClick={() => setFilter('alerts')}
        >
          Alerts · {counts.alerts}{more}
        </button>
      </div>
      {filtered.length === 0 ? (
        kid ? (
          <p className="p-bell-empty">{inbox.isError ? "Can't load notifications right now." : "You're all caught up."}</p>
        ) : inbox.isError ? (
          <ErrorPanel kind="unreachable" error={inbox.error} onRetry={() => inbox.refetch()} />
        ) : (
          <EmptyState icon="notifications_off" title="No notifications" body="We'll ping you when a chore needs your OK." />
        )
      ) : (
        <div className="p-bell-scroll" tabIndex={0} role="region" aria-label="Notification list">
          {byGroup.today.length > 0 && (
            <>
              <div className="p-bell-group">Today</div>
              {byGroup.today.map((n) => {
                const sev = severityIcon(n)
                return (
                  <div key={n.id} className={`p-bell-item ${!n.read ? 'unread' : ''}`}>
                    <div className={`p-bell-icon ${sev.tone}`}>
                      <Icon name={sev.name} />
                    </div>
                    {text(n)}
                    <div className="p-bell-actions">
                      {isNeedsYou(n, pending) && n.kind === 'chore_submitted' && (
                        <>
                          {sending === n.id && (
                            <input
                              className="p-bell-note"
                              aria-label="Note for sending back"
                              placeholder="What should they fix?"
                              value={note}
                              maxLength={500}
                              autoFocus
                              onChange={(e) => setNote(e.target.value)}
                            />
                          )}
                          <button type="button" className="p-btn" data-variant="accent" disabled={busy === n.id} data-loading={busy === n.id} onClick={() => handleApprove(n)}>
                            <Icon name="check" size={16} />
                            Approve {n.points ? `+${n.points}` : ''}
                          </button>
                          <button
                            type="button"
                            className="p-btn"
                            disabled={busy === n.id || (sending === n.id && !note.trim())}
                            onClick={() => (sending === n.id ? handleSendBack(n) : (setSending(n.id), setNote('')))}
                          >
                            <Icon name="undo" size={16} />
                            Send back
                          </button>
                        </>
                      )}
                      {isNeedsYou(n, pending) && n.kind === 'redemption_request' && (
                        <>
                          <button type="button" className="p-btn" data-variant="accent" disabled={busy === n.id} data-loading={busy === n.id} onClick={() => handleRedeem(n)}>
                            <Icon name="check" size={16} />
                            Approve
                          </button>
                          <button type="button" className="p-btn" disabled={busy === n.id} onClick={() => handleDecline(n)}>
                            <Icon name="close" size={16} />
                            Decline
                          </button>
                        </>
                      )}
                      {n.kind === 'new_device' && (
                        <button type="button" className="p-btn" onClick={() => handleView(n)}>
                          <Icon name="person_add" size={16} />
                          Who&apos;s this?
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
                    {text(n)}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
      {hasMore && (
        <button type="button" className="p-btn p-bell-older" disabled={loadingOlder} data-loading={loadingOlder} onClick={showOlder}>
          Show older
        </button>
      )}
    </div>
  )
}

/** Notification bell: popover on desktop, full sheet under 768 px. `kid` uses the kid token. */
export function Bell({ kid = false, placement = 'header' }: { kid?: boolean; placement?: 'rail' | 'header' }) {
  const [opened, setOpened] = useState(false)
  const small = useMediaQuery('(max-width: 767px)')
  const unread = useInbox(kid).data?.unread ?? 0

  // Escape closes the desktop popover wherever focus is (focus stays on the bell)
  useEffect(() => {
    if (!opened) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpened(false) }
    window.addEventListener('keydown', esc, true)
    return () => window.removeEventListener('keydown', esc, true)
  }, [opened])

  // On mobile, don't render bell for rail placement (header only)
  if (placement === 'rail' && small) {
    return null
  }

  const btn = (
    <button
      type="button"
      className={kid ? 'f-bell' : 'p-bell'}
      aria-label={unread ? `Notifications, ${unread > 9 ? '9+' : unread} unread` : 'Notifications'}
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
        <Drawer
          opened={opened}
          onClose={close}
          position="bottom"
          size="100%"
          title="Notifications"
          closeButtonProps={{ 'aria-label': 'Close notifications' }}
          classNames={{ title: 'p-bell-drawer-title', header: 'p-bell-drawer-header', content: 'p-bell-drawer-content', close: 'p-bell-drawer-close' }}
        >
          <List kid={kid} onGo={close} sheet />
        </Drawer>
      </>
    )
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" width={400} shadow="md">
      <Tooltip label="Notifications" openDelay={400} disabled={opened}>
        <Popover.Target>{btn}</Popover.Target>
      </Tooltip>
      <Popover.Dropdown aria-label="Notifications" className={kid ? 'f-bell-pop' : 'p-pop p-bell-pop'}>
        <List kid={kid} onGo={close} />
      </Popover.Dropdown>
    </Popover>
  )
}
