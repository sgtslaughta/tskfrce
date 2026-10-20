import '@testing-library/jest-dom'

// Mock fetch globally
global.fetch = jest.fn()

// Mock environment variables
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000'
process.env.NEXT_PUBLIC_APP_NAME = 'TaaskMaaster'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
    }
  },
}))

// Mock Next.js head
jest.mock('next/head', () => {
  return function Head({ children }) {
    return <>{children}</>
  }
})

// Setup fetch mock responses
beforeEach(() => {
  fetch.mockClear()
  
  // Default health check response
  fetch.mockImplementation((url) => {
    if (url.includes('/health')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          status: 'healthy',
          timestamp: Date.now(),
          version: '0.1.0',
          services: {
            database: 'healthy',
            redis: 'healthy',
            minio: 'healthy'
          }
        }),
        headers: {
          get: (name) => {
            if (name === 'content-type') return 'application/json'
            return null
          }
        }
      })
    }
    
    if (url.includes('/docs')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<html>API Documentation</html>'),
        headers: {
          get: (name) => {
            if (name === 'content-type') return 'text/html'
            return null
          }
        }
      })
    }
    
    if (url.includes('/openapi.json')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          openapi: '3.0.0',
          info: {
            title: 'TaaskMaaster API',
            version: '0.1.0',
            description: 'A comprehensive task management system'
          },
          paths: {}
        }),
        headers: {
          get: (name) => {
            if (name === 'content-type') return 'application/json'
            return null
          }
        }
      })
    }
    
    // Default response for other URLs
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<html>Page Content</html>'),
      headers: {
        get: (name) => {
          if (name === 'content-type') return 'text/html'
          if (name === 'x-content-type-options') return 'nosniff'
          if (name === 'x-frame-options') return 'DENY'
          if (name === 'x-xss-protection') return '1; mode=block'
          return null
        }
      }
    })
  })
})
