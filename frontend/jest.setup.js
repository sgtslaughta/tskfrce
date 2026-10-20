import '@testing-library/jest-dom/jest-globals'

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
