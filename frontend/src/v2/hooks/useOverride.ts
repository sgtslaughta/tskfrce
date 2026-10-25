import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { toastFail, toastOk } from '../notify'
import type { OverrideAction } from '../types'

export interface OverrideTarget {
  kind: 'device' | 'kid' | 'group'
  id: number
}

export type OverrideChoice = { action: OverrideAction; minutes: number | null } | { action: 'clear' }

const BASE = { device: 'devices', kid: 'kids', group: 'groups' } as const
const TOAST = { lock: 'Locked', unlock: 'Unlocked', clear: 'Back on schedule' }

/** Lock / unlock (optionally timed) or clear the manual override on a device, kid or group. */
export function useOverride() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ target, choice }: { target: OverrideTarget; choice: OverrideChoice }) => {
      const url = `/${BASE[target.kind]}/${target.id}/override`
      return choice.action === 'clear'
        ? api(url, { method: 'DELETE' })
        : api(url, { method: 'POST', body: { action: choice.action, minutes: choice.minutes } })
    },
    onSuccess: (_d, { choice }) => {
      toastOk(TOAST[choice.action])
      qc.invalidateQueries({ queryKey: ['today'] })
      qc.invalidateQueries({ queryKey: ['devices'] })
    },
    onError: toastFail,
  })
}
