import { Button } from '@mantine/core'
import type { KidWhoami } from '../types'

type K = KidWhoami['kids'][number]

/** Big avatar buttons. Never picks for the kid. */
export function KidPicker({ kids, onPick }: { kids: K[]; onPick: (k: K) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
      {kids.map((k) => (
        <Button
          key={k.id}
          variant="default"
          onClick={() => onPick(k)}
          style={{ height: 150, width: 150 }}
          styles={{ label: { flexDirection: 'column', gap: 6, whiteSpace: 'normal' } }}
        >
          <span aria-hidden style={{ fontSize: 56, lineHeight: 1 }}>
            {k.avatar || '🙂'}
          </span>
          <span style={{ fontSize: 22 }}>{k.full_name || 'Me'}</span>
        </Button>
      ))}
    </div>
  )
}
