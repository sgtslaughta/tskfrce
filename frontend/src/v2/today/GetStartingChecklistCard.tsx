import Link from 'next/link'
import { Tooltip } from '@mantine/core'
import { Icon } from '../parent/Icon'
import { useTipState } from '../hooks/useTips'
import { useWindows } from '../hooks/useWindows'
import { useParents } from '../hooks/useFamily'
import type { TodayKid } from '../types'

interface Props {
  kids: TodayKid[]
}

export function GetStartingChecklistCard({ kids }: Props) {
  const { isDismissed, dismiss } = useTipState()
  const hours = (useWindows().data?.length ?? 0) > 0
  const parents = useParents().data?.length ?? 0

  const items = [
    {
      key: 'kid',
      label: 'Add a kid',
      done: kids.length > 0,
      href: '/kids',
      icon: 'person_add',
    },
    {
      key: 'chore',
      label: 'Add chores',
      done: kids.some((k) => (k.chores?.length ?? 0) > 0),
      href: '/kids?section=chores',
      icon: 'task_alt',
    },
    {
      key: 'device',
      label: 'Name devices',
      done: kids.some((k) => k.devices.length > 0),
      href: '/devices',
      icon: 'devices',
    },
    {
      key: 'hours',
      label: 'Set hours',
      done: hours,
      href: '/settings?section=hours',
      icon: 'schedule',
    },
    {
      key: 'other_parent',
      label: 'Invite other parent',
      done: parents > 1,
      href: '/settings?section=parents',
      icon: 'people',
    },
  ]

  const doneCount = items.filter((i) => i.done).length
  const allDone = doneCount === items.length
  const wasDismissed = isDismissed('onboard.parent')

  if (allDone || wasDismissed) return null

  return (
    <div className="p-onboard-card" data-testid="parent-onboarding">
      <div className="p-onboard-header">
        <div>
          <h2 className="p-onboard-title">Getting started</h2>
          <p className="p-onboard-progress">
            {doneCount} of {items.length} done
          </p>
        </div>
        <Tooltip label="Dismiss" openDelay={400}>
          <button
            className="p-onboard-dismiss"
            onClick={() => dismiss('onboard.parent')}
            aria-label="Dismiss getting started"
            type="button"
          >
            <Icon name="close" size={18} />
          </button>
        </Tooltip>
      </div>

      <ul className="p-onboard-items">
        {items.map((item) => (
          <li key={item.key} className="p-onboard-item" data-done={item.done}>
            <Link href={item.href}>
              <div className="p-onboard-icon" data-done={item.done}>
                <Icon name={item.done ? 'check' : item.icon} size={16} />
              </div>
              <span className="p-onboard-label">{item.label}</span>
              {!item.done && (
                <Icon name="arrow_forward" size={16} className="p-onboard-arrow" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
