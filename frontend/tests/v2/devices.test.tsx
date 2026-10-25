import { describe, expect, test } from '@jest/globals'
import { isPrivateMac } from '@/v2/manage/privateMac'

// Behaviour of the device list, detail and groups lives in devicesEdge.test.tsx and pinNudge.test.tsx.
describe('privateMac', () => {
  test.each([
    ['3a:1f:00:00:c2:09', true], // 0x3a has the locally-administered bit
    ['02:aa:bb:cc:dd:ee', true],
    ['fe:bb:cc:dd:ee:ff', true],
    ['00:1f:aa:bb:cc:dd', false],
    ['01:bb:cc:dd:ee:ff', false], // multicast bit only
  ])('isPrivateMac(%s) is %s', (mac, want) => {
    expect(isPrivateMac(mac)).toBe(want)
  })
})
