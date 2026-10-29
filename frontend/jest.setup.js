import '@testing-library/jest-dom/jest-globals'
import fs from 'fs'
import path from 'path'

// Load CSS files into the DOM for testing
const parentTokensCss = fs.readFileSync(
  path.join(__dirname, 'src/v2/parent/parent-tokens.css'),
  'utf8'
)
const motionCss = fs.readFileSync(
  path.join(__dirname, 'src/v2/parent/motion.css'),
  'utf8'
)

// Inject styles into document head
const style = document.createElement('style')
style.textContent = parentTokensCss + '\n' + motionCss
document.head.appendChild(style)

// Also set CSS custom properties directly on the root element for getComputedStyle to work
document.documentElement.style.setProperty('--dur-1', '150ms')
document.documentElement.style.setProperty('--dur-2', '250ms')
document.documentElement.style.setProperty('--ease-out', 'cubic-bezier(0.25, 0.46, 0.45, 0.94)')

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
      isFallback: false,
    }
  },
}))
