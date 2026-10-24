// Global `jest` typed from @jest/globals (no @types/jest). Keep `jest` global so next/jest hoists jest.mock.
import type { jest as JestType } from '@jest/globals'

declare global {
  const jest: typeof JestType
}
