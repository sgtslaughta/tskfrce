/**
 * Health check tests for TaaskMaaster frontend.
 * 
 * These tests verify that the basic frontend functionality
 * and API connectivity are working correctly.
 */

describe('Frontend Health Checks', () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  describe('Frontend Accessibility', () => {
    test('should load the main page', async () => {
      const response = await fetch(frontendUrl);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    });

    test('should have proper HTML structure', async () => {
      const response = await fetch(frontendUrl);
      const html = await response.text();
      
      // Check for basic HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
    });

    test('should include Next.js meta tags', async () => {
      const response = await fetch(frontendUrl);
      const html = await response.text();
      
      // Check for Next.js specific meta tags
      expect(html).toContain('next-head');
      expect(html).toContain('viewport');
    });
  });

  describe('API Connectivity', () => {
    test('should be able to reach backend API', async () => {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data.status).toBe('healthy');
    });

    test('should be able to access API documentation', async () => {
      const response = await fetch(`${baseUrl}/docs`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    });

    test('should be able to access OpenAPI spec', async () => {
      const response = await fetch(`${baseUrl}/openapi.json`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('openapi');
      expect(data).toHaveProperty('info');
      expect(data).toHaveProperty('paths');
    });
  });

  describe('Environment Configuration', () => {
    test('should have required environment variables', () => {
      expect(process.env.NEXT_PUBLIC_API_URL).toBeDefined();
      expect(process.env.NEXT_PUBLIC_APP_NAME).toBeDefined();
    });

    test('should have correct API URL format', () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      expect(apiUrl).toMatch(/^https?:\/\/.+/);
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await fetch(frontendUrl);
      
      const headers = response.headers;
      
      // Check for security headers
      const securityHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection'
      ];
      
      securityHeaders.forEach(header => {
        expect(headers.get(header)).toBeDefined();
      });
    });

    test('should have proper CORS configuration', async () => {
      const response = await fetch(frontendUrl, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'content-type'
        }
      });
      
      expect(response.status).toBe(200);
      
      const headers = response.headers;
      expect(headers.get('access-control-allow-origin')).toBeDefined();
      expect(headers.get('access-control-allow-methods')).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should load within reasonable time', async () => {
      const startTime = Date.now();
      const response = await fetch(frontendUrl);
      const loadTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    });

    test('should have reasonable response size', async () => {
      const response = await fetch(frontendUrl);
      const contentLength = response.headers.get('content-length');
      
      if (contentLength) {
        const sizeInKB = parseInt(contentLength) / 1024;
        expect(sizeInKB).toBeLessThan(1000); // Should be less than 1MB
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 errors gracefully', async () => {
      const response = await fetch(`${frontendUrl}/non-existent-page`);
      expect(response.status).toBe(404);
    });

    test('should handle API errors gracefully', async () => {
      const response = await fetch(`${baseUrl}/non-existent-endpoint`);
      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data).toHaveProperty('detail');
    });
  });
});

// Mock fetch for testing if not available
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// Test configuration
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
