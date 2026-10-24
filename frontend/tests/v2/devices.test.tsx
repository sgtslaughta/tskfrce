import { describe, expect, test } from '@jest/globals'
import { isPrivateMac } from '@/v2/manage/privateMac'

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
