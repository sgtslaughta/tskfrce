import Link from 'next/link'
import { ActionIcon, Group, Stack } from '@mantine/core'
import { Icon } from '../parent/Icon'
import { useTips } from '../hooks/useTips'
import type { TodayKid } from '../types'

interface Props {
  kids: TodayKid[]
  devicesCount?: number
}

export function GetStartingChecklistCard({ kids, devicesCount = 0 }: Props) {
  const { isDismissed, dismiss } = useTips()

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
      done: devicesCount > 0,
      href: '/devices',
      icon: 'devices',
    },
    {
      key: 'hours',
      label: 'Set hours',
      done: false,
      href: '/settings?section=hours',
      icon: 'schedule',
    },
    {
      key: 'other_parent',
      label: 'Invite other parent',
      done: false,
      href: '/settings?section=parents',
      icon: 'people',
    },
  ]

  const doneCount = items.filter((i) => i.done).length
  const allDone = doneCount === items.length
  const wasDismissed = isDismissed('onboard.parent')

  if (allDone || wasDismissed) return null

  return (
    <div
      className="p-card"
      style={{
        marginBottom: 16,
        padding: 16,
        border: `1px solid var(--p-line)`,
      }}
    >
      <Group justify="space-between" mb="md">
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 600 }}>
            Getting started
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--p-sub)',
            }}
          >
            {doneCount} of {items.length} done
          </p>
        </div>
        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={() => dismiss('onboard.parent')}
          aria-label="Dismiss getting started"
        >
          <Icon name="close" size={18} />
        </ActionIcon>
      </Group>

      <Stack gap="xs">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 0',
              textDecoration: 'none',
              color: 'inherit',
              opacity: item.done ? 0.5 : 1,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: 4,
                backgroundColor: item.done ? 'var(--p-acc)' : 'var(--p-soft)',
                color: item.done ? '#292928' : 'var(--p-sub)',
              }}
            >
              {item.done ? (
                <Icon name="check" size={16} />
              ) : (
                <Icon name={item.icon} size={16} />
              )}
            </div>
            <span style={{ flex: 1 }}>{item.label}</span>
            {!item.done && (
              <span style={{ color: 'var(--p-sub)' }}>
                <Icon name="arrow_forward" size={16} />
              </span>
            )}
          </Link>
        ))}
      </Stack>
    </div>
  )
}
