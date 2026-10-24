import { describe, expect, test } from '@jest/globals'
import { isPrivateMac } from '@/v2/manage/privateMac'

// Helper functions for device filtering and display
const maskMac = (mac: string) => {
  if (mac.length < 17) return mac
  return mac.substring(0, 6) + '••:••' + mac.substring(11)
}

const ownerName = (ownerIds: number[], kidMap: Map<number, string>) => {
  if (ownerIds.length === 0) return 'Unassigned'
  return ownerIds.map((id) => kidMap.get(id) || 'Unknown').join(', ')
}

describe('privateMac', () => {
  test("isPrivateMac('3a:1f:00:00:c2:09') returns true when first octet has 0x02 bit set", () => {
    // 0x3a = 0011 1010, which has bit 0x02 set (locally administered)
    expect(isPrivateMac('3a:1f:00:00:c2:09')).toBe(true)
  })

  test("isPrivateMac('00:1f:aa:bb:cc:dd') returns false when first octet has no 0x02 bit", () => {
    // 0x00 = 0000 0000, no 0x02 bit
    expect(isPrivateMac('00:1f:aa:bb:cc:dd')).toBe(false)
  })

  test("isPrivateMac('02:aa:bb:cc:dd:ee') returns true for clear 0x02 bit", () => {
    // 0x02 = 0000 0010, has 0x02 bit set
    expect(isPrivateMac('02:aa:bb:cc:dd:ee')).toBe(true)
  })

  test("isPrivateMac('fe:bb:cc:dd:ee:ff') returns true when first octet is high", () => {
    // 0xfe = 1111 1110, has 0x02 bit set
    expect(isPrivateMac('fe:bb:cc:dd:ee:ff')).toBe(true)
  })

  test("isPrivateMac('01:bb:cc:dd:ee:ff') returns false when only 0x01 bit is set", () => {
    // 0x01 = 0000 0001, no 0x02 bit
    expect(isPrivateMac('01:bb:cc:dd:ee:ff')).toBe(false)
  })
})

describe('Device utility functions', () => {
  test('maskMac masks middle octets of a MAC address', () => {
    const mac = '00:1a:2b:3c:4d:5e'
    expect(maskMac(mac)).toBe('00:1a:••:••:4d:5e')
  })

  test('maskMac returns input unchanged if shorter than 17 characters', () => {
    const shortMac = '00:1a:2b'
    expect(maskMac(shortMac)).toBe(shortMac)
  })

  test('maskMac correctly masks private MAC address', () => {
    const privateMac = '02:1a:2b:3c:4d:5e'
    expect(maskMac(privateMac)).toBe('02:1a:••:••:4d:5e')
    expect(isPrivateMac(privateMac)).toBe(true)
  })

  test('ownerName returns Unassigned for empty owner list', () => {
    const kidMap = new Map([[1, 'Alice']])
    expect(ownerName([], kidMap)).toBe('Unassigned')
  })

  test('ownerName returns kid names from owner IDs', () => {
    const kidMap = new Map([
      [1, 'Alice'],
      [2, 'Bob'],
    ])
    expect(ownerName([1, 2], kidMap)).toBe('Alice, Bob')
  })

  test('ownerName handles missing kid IDs gracefully', () => {
    const kidMap = new Map([[1, 'Alice']])
    expect(ownerName([1, 3], kidMap)).toBe('Alice, Unknown')
  })
})

describe('Device pinning and status', () => {
  test('unassigned devices should be pinned before assigned', () => {
    const devices = [
      { id: 1, status: 'assigned', name: 'Device A' },
      { id: 2, status: 'unassigned', name: 'Device B' },
      { id: 3, status: 'assigned', name: 'Device C' },
    ]
    const unassigned = devices.filter((d) => d.status === 'unassigned')
    const assigned = devices.filter((d) => d.status !== 'unassigned')
    const sorted = [...unassigned, ...assigned]
    expect(sorted[0].status).toBe('unassigned')
    expect(sorted[1].status).toBe('assigned')
  })
})

describe('Device group operations', () => {
  test('calculates locked device count in a group', () => {
    const groupDevices = [
      { id: 1, status: 'locked', override: null },
      { id: 2, status: 'assigned', override: { action: 'lock' } },
      { id: 3, status: 'assigned', override: null },
    ]
    const locked = groupDevices.filter((d) => d.override?.action === 'lock').length
    expect(locked).toBe(1)
  })

  test('counts devices in a group', () => {
    const groupDeviceIds = [1, 2, 3]
    const devices = [
      { id: 1, name: 'Device 1' },
      { id: 2, name: 'Device 2' },
      { id: 3, name: 'Device 3' },
      { id: 4, name: 'Device 4' },
    ]
    const groupDevices = devices.filter((d) => groupDeviceIds.includes(d.id))
    expect(groupDevices.length).toBe(3)
  })
})
