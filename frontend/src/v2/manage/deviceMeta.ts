export type DeviceType = 'phone' | 'console' | 'tv' | 'laptop' | 'tablet' | 'other'

export const DEVICE_TYPE_ICON: Record<DeviceType, string> = {
  phone: 'smartphone',
  tablet: 'tablet_mac',
  console: 'sports_esports',
  tv: 'tv',
  laptop: 'laptop_chromebook',
  other: 'devices_other',
}

export const getDeviceType = (name: string, vendor?: string | null): DeviceType => {
  const text = `${name} ${vendor ?? ''}`
  if (/xbox|playstation|\bps[345]\b|nintendo|switch|steam ?deck/i.test(text)) return 'console'
  if (/\btv\b|roku|chromecast|fire ?stick|apple ?tv|shield|bravia/i.test(text)) return 'tv'
  if (/laptop|macbook|chromebook|thinkpad|\bpc\b|desktop|imac/i.test(text)) return 'laptop'
  if (/ipad|tablet|kindle/i.test(text)) return 'tablet'
  if (/phone|pixel|galaxy|android|iphone/i.test(text)) return 'phone'
  return 'other'
}

/** "just now", "5m ago", "3h ago", "2d ago". A clock a little ahead of the box never shows a negative. */
export const ago = (iso: string | null | undefined): string => {
  if (!iso) return 'never'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (!(mins >= 1)) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`
}

/** Date and time in the family's time zone (the zone the hours run on), falling back to the browser's. */
export const inFamilyZone = (iso: string, timeZone?: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }): string => {
  try {
    return new Date(iso).toLocaleString(undefined, { ...opts, timeZone })
  } catch {
    return new Date(iso).toLocaleString(undefined, opts)
  }
}
