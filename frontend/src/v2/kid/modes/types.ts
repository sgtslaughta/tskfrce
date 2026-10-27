import type { KidToday } from '../../types'

/** Props every age mode (Little / Kid / Teen) takes from the KidApp shell. */
export interface ModeProps {
  d: KidToday
  name: string
  avatar: string | null
  now: number
  onDone: (id: number) => void
  busyId: number | null
  /** already a no-op in preview */
  onSeen: (id: number) => void
  /** undefined in preview and Little */
  onChat?: (id: number) => void
}

export type KidAge = 'little' | 'kid' | 'teen'
