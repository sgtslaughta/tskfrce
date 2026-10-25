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
