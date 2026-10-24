import { useMemo } from 'react'

interface TipsState {
  isDismissed(key: string): boolean
  dismiss(key: string): void
}

/** Minimal tips hook for onboarding UI (parent + kid intro). */
export function useTips(): TipsState {
  const storage = typeof window !== 'undefined' ? localStorage : null
  const prefix = 'task4ce-tip:'

  return useMemo(
    () => ({
      isDismissed(key: string): boolean {
        try {
          return (storage?.getItem(prefix + key) ?? '') === '1'
        } catch {
          return false
        }
      },
      dismiss(key: string): void {
        try {
          storage?.setItem(prefix + key, '1')
        } catch {
          // SSR or private browsing
        }
      },
    }),
    [storage],
  )
}
