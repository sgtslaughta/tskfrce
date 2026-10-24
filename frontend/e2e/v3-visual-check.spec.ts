import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://127.0.0.1:3766';
const OUTPUT_DIR = './e2e/__shots__/v3';

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input', { timeout: 5000 }).catch(() => {});

  const inputs = await page.locator('input').all();
  if (inputs.length >= 2) {
    await inputs[0].fill('admin');
    await inputs[1].fill('demo-parent-1');

    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text?.toLowerCase().includes('log in') || text?.toLowerCase().includes('login')) {
        await btn.click();
        break;
      }
    }

    await page.waitForNavigation({ timeout: 10000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  }
}

async function setTheme(page: Page, isDark: boolean) {
  if (isDark) {
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-mantine-color-scheme', 'dark');
    });
  } else {
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-mantine-color-scheme', 'light');
    });
  }
  await page.waitForTimeout(300);
}

async function captureScreen(page: Page, route: string, viewport: { width: number; height: number }, theme: string, filename: string) {
  await page.goto(`${BASE_URL}${route}`);
  await setTheme(page, theme === 'dark');
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  await page.screenshot({ path: filename, fullPage: false });
}

test.describe('v3 Parent visual checks', () => {
  test('capture desktop light screens', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    await login(page);

    const screens = [
      { route: '/', name: 'today' },
      { route: '/devices', name: 'devices' },
      { route: '/kids', name: 'kids' },
      { route: '/chat', name: 'chat' },
      { route: '/settings', name: 'settings' },
      { route: '/more', name: 'more' },
    ];

    for (const screen of screens) {
      const filename = path.join(OUTPUT_DIR, `desktop-${screen.name}-light.png`);
      await captureScreen(page, screen.route, { width: 1280, height: 800 }, 'light', filename);
      console.log(`✓ ${filename}`);
    }

    // Kid preview
    const kidFilename = path.join(OUTPUT_DIR, `desktop-kid-preview-light.png`);
    await captureScreen(page, '/kid?as=1', { width: 1280, height: 800 }, 'light', kidFilename);
    console.log(`✓ ${kidFilename}`);

    await context.close();
  });

  test('capture desktop dark screens', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    await login(page);

    const screens = [
      { route: '/', name: 'today' },
      { route: '/devices', name: 'devices' },
      { route: '/kids', name: 'kids' },
      { route: '/chat', name: 'chat' },
      { route: '/settings', name: 'settings' },
      { route: '/more', name: 'more' },
    ];

    for (const screen of screens) {
      const filename = path.join(OUTPUT_DIR, `desktop-${screen.name}-dark.png`);
      await captureScreen(page, screen.route, { width: 1280, height: 800 }, 'dark', filename);
      console.log(`✓ ${filename}`);
    }

    // Kid preview
    const kidFilename = path.join(OUTPUT_DIR, `desktop-kid-preview-dark.png`);
    await captureScreen(page, '/kid?as=1', { width: 1280, height: 800 }, 'dark', kidFilename);
    console.log(`✓ ${kidFilename}`);

    await context.close();
  });

  test('capture phone light screens', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    await login(page);

    const screens = [
      { route: '/', name: 'today' },
      { route: '/devices', name: 'devices' },
      { route: '/kids', name: 'kids' },
      { route: '/chat', name: 'chat' },
      { route: '/settings', name: 'settings' },
      { route: '/more', name: 'more' },
    ];

    for (const screen of screens) {
      const filename = path.join(OUTPUT_DIR, `phone-${screen.name}-light.png`);
      await captureScreen(page, screen.route, { width: 390, height: 844 }, 'light', filename);
      console.log(`✓ ${filename}`);
    }

    await context.close();
  });

  test('capture phone dark screens', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    await login(page);

    const screens = [
      { route: '/', name: 'today' },
      { route: '/devices', name: 'devices' },
      { route: '/kids', name: 'kids' },
      { route: '/chat', name: 'chat' },
      { route: '/settings', name: 'settings' },
      { route: '/more', name: 'more' },
    ];

    for (const screen of screens) {
      const filename = path.join(OUTPUT_DIR, `phone-${screen.name}-dark.png`);
      await captureScreen(page, screen.route, { width: 390, height: 844 }, 'dark', filename);
      console.log(`✓ ${filename}`);
    }

    await context.close();
  });

  test('capture login and 404', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    // Login - light and dark
    const loginLightFile = path.join(OUTPUT_DIR, 'desktop-login-light.png');
    await page.goto(`${BASE_URL}/login`);
    await setTheme(page, false);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: loginLightFile, fullPage: false });
    console.log(`✓ ${loginLightFile}`);

    const loginDarkFile = path.join(OUTPUT_DIR, 'desktop-login-dark.png');
    await page.goto(`${BASE_URL}/login`);
    await setTheme(page, true);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: loginDarkFile, fullPage: false });
    console.log(`✓ ${loginDarkFile}`);

    // 404
    const notFoundFile = path.join(OUTPUT_DIR, 'desktop-404-light.png');
    await page.goto(`${BASE_URL}/nonexistent-page`);
    await setTheme(page, false);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: notFoundFile, fullPage: false });
    console.log(`✓ ${notFoundFile}`);

    await context.close();
  });

  test('no horizontal overflow at 360px', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const page = await context.newPage();

    await login(page);

    const screens = ['/', '/devices', '/kids', '/chat', '/settings', '/more'];

    for (const route of screens) {
      await page.goto(`${BASE_URL}${route}`);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(360);
    }

    await context.close();
  });

  test('kid page keeps fridge tokens', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    await login(page);
    await page.goto(`${BASE_URL}/kid?as=1`);

    const fridgeBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--f-bg').trim();
    });

    // Should be the fridge light background
    expect(fridgeBg).toMatch(/#f4f7fa/i);

    await context.close();
  });
});
