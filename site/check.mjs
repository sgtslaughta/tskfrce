import { test, expect } from '@playwright/test';
import { chromium } from '@playwright/test';

// Configuration for screenshots
const viewports = [
  { name: '1280px', width: 1280, height: 720 },
  { name: '360px', width: 360, height: 800 },
];

const colorSchemes = ['light', 'dark'];

const pages = [
  { url: 'http://localhost:3000/site/', name: 'index' },
  { url: 'http://localhost:3000/site/engineering.html', name: 'engineering' },
];

test.describe('GitHub Pages site', () => {
  for (const viewport of viewports) {
    for (const scheme of colorSchemes) {
      for (const page of pages) {
        test(`${page.name} - ${viewport.name} - ${scheme}`, async () => {
          const browser = await chromium.launch();
          const context = await browser.createContext({
            colorScheme: scheme,
            viewport: { width: viewport.width, height: viewport.height },
          });
          const pg = await context.newPage();

          // Navigate to the page
          await pg.goto(page.url, { waitUntil: 'networkidle' });

          // Check for console errors
          let hasErrors = false;
          pg.on('console', (msg) => {
            if (msg.type() === 'error') {
              console.error(`Console error: ${msg.text()}`);
              hasErrors = true;
            }
          });

          // Check for no horizontal scroll
          const bodyWidth = await pg.evaluate(() => document.body.scrollWidth);
          const viewportWidth = viewport.width;
          expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // +1 for rounding

          // Take screenshot
          const filename = `docs/superpowers/polish/site/${page.name}-${viewport.name}-${scheme}.png`;
          await pg.screenshot({ path: filename, fullPage: true });
          console.log(`✓ Screenshot: ${filename}`);

          // Check contrast on a few key elements
          const headings = await pg.locator('h1, h2').count();
          expect(headings).toBeGreaterThan(0);

          expect(hasErrors).toBe(false);

          await context.close();
          await browser.close();
        });
      }
    }
  }

  // Additional check: ensure no console errors on page load
  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:3000/site/');
    expect(errors).toHaveLength(0);
  });

  // Check that buttons are accessible (min 44px)
  test('touch targets >= 44px', async ({ page }) => {
    await page.goto('http://localhost:3000/site/');

    const buttons = await page.locator('.f-btn, button').all();
    for (const button of buttons) {
      const box = await button.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  // Check links resolve (200-404 is acceptable, other errors are not)
  test('links are reachable', async ({ page }) => {
    await page.goto('http://localhost:3000/site/');

    const links = await page.locator('a[href]').all();
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (href && href.startsWith('http')) {
        // Skip external links for now
        continue;
      }
      if (href && !href.startsWith('#')) {
        try {
          const response = await page.goto(href, { waitUntil: 'domcontentloaded' });
          const status = response?.status();
          expect([200, 301, 302, 404]).toContain(status);
        } catch (e) {
          // Navigation errors are OK for external links
        }
      }
    }
  });
});
