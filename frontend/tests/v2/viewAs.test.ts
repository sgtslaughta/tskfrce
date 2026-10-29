import { expect, test } from '@jest/globals'
import { backFrom, viewAs } from '@/v2/kid/viewAs'

test('view as kid returns to where it came from, same-site only', () => {
  expect(viewAs(3, '/chat?item=chore:9')).toBe('/kid?as=3&back=%2Fchat%3Fitem%3Dchore%3A9')
  expect(backFrom('/chat?item=chore:9', 3)).toBe('/chat?item=chore:9')
  expect(backFrom('//evil.com', 3)).toBe('/?item=3')
  expect(backFrom('https://evil.com', 3)).toBe('/?item=3')
  expect(backFrom(undefined, 3)).toBe('/?item=3')
  expect(backFrom('/.//evil.com', 3)).toBe('/?item=3')
  expect(backFrom('/a/..//evil.com', 3)).toBe('/?item=3')
  expect(backFrom('/\t/evil.com', 3)).toBe('/?item=3')
  expect(backFrom('/\\evil.com', 3)).toBe('/?item=3')
})
