import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { toastFail, toastOk } from '../notify'
import type { Override, OverrideAction } from '../types'

export interface OverrideTarget {
  kind: 'device' | 'kid' | 'group'
  id: number
}

export type OverrideChoice = { action: OverrideAction; minutes: number | null } | { action: 'clear' }

const BASE = { device: 'devices', kid: 'kids', group: 'groups' } as const
const TOAST = { lock: 'Locked', unlock: 'Unlocked', clear: 'Back on schedule' }

const send = (target: OverrideTarget, choice: OverrideChoice) => {
  const url = `/${BASE[target.kind]}/${target.id}/override`
  return choice.action === 'clear'
    ? api(url, { method: 'DELETE' })
    : api(url, { method: 'POST', body: { action: choice.action, minutes: choice.minutes } })
}

/** What puts a target back as it was: its previous manual override (minutes left), or the schedule. */
export function undoChoice(previous: Override | null | undefined, now = Date.now()): OverrideChoice {
  if (!previous || (previous.expires_at && Date.parse(previous.expires_at) <= now)) return { action: 'clear' }
  const left = previous.expires_at ? Math.ceil((Date.parse(previous.expires_at) - now) / 60_000) : null
  return { action: previous.action, minutes: left }
}

/** Lock / unlock (optionally timed) or clear the manual override on a device, kid or group. Locking offers Undo. */
export function useOverride() {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['today'] })
    qc.invalidateQueries({ queryKey: ['devices'] })
    qc.invalidateQueries({ queryKey: ['device-activity'] }) // lock history
  }
  return useMutation({
    mutationFn: ({ target, choice }: { target: OverrideTarget; choice: OverrideChoice; previous?: Override | null }) => send(target, choice),
    onSuccess: (_d, { target, choice, previous }) => {
      const undo = choice.action === 'lock' ? () => send(target, undoChoice(previous)).then(() => toastOk('Undone'), toastFail).finally(refresh) : undefined
      toastOk(TOAST[choice.action], { undo })
      refresh()
    },
    onError: toastFail,
  })
}
