/**
 * Check if a MAC address uses a locally-administered address (private MAC).
 * The locally-administered bit is the 0x02 bit in the first octet.
 * @param mac MAC address string like "3a:1f:00:00:c2:09"
 * @returns true if the MAC uses a locally-administered address
 */
export function isPrivateMac(mac: string): boolean {
  if (!mac || mac.length < 2) return false
  const firstOctet = parseInt(mac.substring(0, 2), 16)
  return (firstOctet & 0x02) !== 0
}
