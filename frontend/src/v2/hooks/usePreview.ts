import { createContext, useContext } from 'react'
import { ApiError, type ApiInit } from '../api'

let previewName: string | null = null
export const setPreviewName = (name: string | null) => {
  previewName = name
}
export const previewMsg = (): string => `Preview only. Log in as ${previewName ?? 'the kid'} to do this.`

/** Kid id a parent is previewing, or null on the real kid screen. */
const Preview = createContext<number | null>(null)
export const PreviewProvider = Preview.Provider
export const useAsKid = () => useContext(Preview)

/** Api options for kid routes: parent token + X-View-As while previewing, kid token otherwise. */
export const kidInit = (as: number | null): ApiInit => (as ? { asKid: as } : { kid: true })

/** Mutation body that refuses (and toasts via onError) while previewing. */
export const blocked = (): Promise<never> => Promise.reject(new ApiError(403, previewMsg()))
