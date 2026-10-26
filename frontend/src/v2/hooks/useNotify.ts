import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/v2/api'

export interface Place {
  id: number
  name: string
  url_mask: string
  enabled: boolean
  events: string[]
  readable: boolean
}

export interface NotifyEvent {
  key: string
  label: string
  security: boolean
}

export interface NotifySettings {
  quiet_start: string | null
  quiet_end: string | null
  quiet_security: boolean
  app_address: string | null
  app_address_default: string | null
  events: NotifyEvent[]
}

export interface PlaceBody {
  name?: string
  url?: string
  events?: string[]
  enabled?: boolean
}

export type SettingsPatch = Partial<Omit<NotifySettings, 'events' | 'app_address_default'>>

export const usePlaces = () => useQuery({ queryKey: ['notify', 'places'], queryFn: () => api<Place[]>('/notify/places') })

export const useNotifySettings = () =>
  useQuery({ queryKey: ['notify', 'settings'], queryFn: () => api<NotifySettings>('/notify/settings') })

function useNotifyMutation<V, R = unknown>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['notify'] }) })
}

export const useAddPlace = () =>
  useNotifyMutation((body: PlaceBody & { name: string; url: string }) => api<Place>('/notify/places', { method: 'POST', body }))

export const usePatchPlace = () =>
  useNotifyMutation(({ id, ...body }: PlaceBody & { id: number }) =>
    api<Place>(`/notify/places/${id}`, { method: 'PATCH', body }),
  )

export const useDeletePlace = () => useNotifyMutation((id: number) => api(`/notify/places/${id}`, { method: 'DELETE' }))

/** Sends one test ping; a failed send is a normal reply with ok false, not a thrown error. */
export const useTestPlace = () =>
  useMutation({
    mutationFn: (id: number) => api<{ ok: boolean; error: string | null }>(`/notify/places/${id}/test`, { method: 'POST' }),
  })

export const usePatchNotifySettings = () =>
  useNotifyMutation((body: SettingsPatch) => api<NotifySettings>('/notify/settings', { method: 'PATCH', body }))
