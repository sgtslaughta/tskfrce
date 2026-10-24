import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://127.0.0.1:3766';
const OUTPUT_DIR = '/tmp/claude-1000/-home-user-code-tskfrce/703677af-a608-4fd2-b15d-f5a67067416b/scratchpad/shots';

const PARENT_CREDS = { username: 'labparent', password: 'labpassword1' };

async function loginUI(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel('Username').fill(PARENT_CREDS.username);
  await page.getByLabel('Password').fill(PARENT_CREDS.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
}

async function main() {
  const browser = await chromium.launch();
  const screenshotsDir = path.join(OUTPUT_DIR, 'v3');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const sizes = [
    { width: 1280, height: 800, label: '1280x800' },
    { width: 390, height: 844, label: '390x844' }
  ];

  // Parent routes that need authentication
  const parentRoutes = [
    { path: '/', label: 'today' },
    { path: '/devices', label: 'devices' },
    { path: '/kids', label: 'kids' },
    { path: '/chat', label: 'chat' },
    { path: '/settings', label: 'settings' },
    { path: '/more', label: 'more' }
  ];

  // Public routes
  const publicRoutes = [
    { path: '/login', label: 'login' },
    { path: '/setup', label: 'setup' },
    { path: '/__test_404__', label: '404' }
  ];

  // Screenshot parent routes (need login)
  for (const size of sizes) {
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });

    for (const theme of ['light', 'dark']) {
      const page = await context.newPage();

      try {
        // Set theme preference
        if (theme === 'dark') {
          await page.addInitScript(() => {
            localStorage.setItem('mantine-color-scheme-value', 'dark');
          });
        }

        // Login
        try {
          await loginUI(page);
          console.log(`✓ Logged in (${size.label}, ${theme})`);
        } catch (e) {
          console.error(`✗ Login failed: ${e.message}`);
          await page.close();
          continue;
        }

        // Take screenshots of parent routes
        for (const route of parentRoutes) {
          const page2 = await context.newPage();
          try {
            if (theme === 'dark') {
              await page2.addInitScript(() => {
                localStorage.setItem('mantine-color-scheme-value', 'dark');
              });
            }

            await page2.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 30000 });
            await page2.waitForTimeout(500);

            const filename = `${route.label}-${size.label}-${theme}.png`;
            const filepath = path.join(screenshotsDir, filename);

            await page2.screenshot({ path: filepath, fullPage: false });
            console.log(`✓ ${filename}`);
          } catch (e) {
            console.error(`✗ ${route.label} ${size.label} ${theme}: ${e.message}`);
          } finally {
            await page2.close();
          }
        }
      } finally {
        await page.close();
      }
    }

    await context.close();
  }

  // Screenshot public routes (no login needed)
  for (const size of sizes) {
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });

    for (const route of publicRoutes) {
      for (const theme of ['light', 'dark']) {
        const page = await context.newPage();

        try {
          if (theme === 'dark') {
            await page.addInitScript(() => {
              localStorage.setItem('mantine-color-scheme-value', 'dark');
            });
          }

          await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForTimeout(500);

          const filename = `${route.label}-${size.label}-${theme}.png`;
          const filepath = path.join(screenshotsDir, filename);

          await page.screenshot({ path: filepath, fullPage: false });
          console.log(`✓ ${filename}`);
        } catch (e) {
          console.error(`✗ ${route.label} ${size.label} ${theme}: ${e.message}`);
        } finally {
          await page.close();
        }
      }
    }

    await context.close();
  }

  // Kid preview screenshot
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    try {
      // Get a kid ID from authenticated context
      await loginUI(page);

      // Try to find a kid ID
      const kidId = await page.evaluate(() => {
        // Try to find from the DOM
        const kidElements = document.querySelectorAll('[data-kid-id]');
        if (kidElements.length > 0) {
          return kidElements[0].getAttribute('data-kid-id');
        }
        // Try other selectors
        const links = Array.from(document.querySelectorAll('a[href*="?as="]'));
        for (const link of links) {
          const match = link.getAttribute('href').match(/as=(\d+)/);
          if (match) return match[1];
        }
        return '1';
      });

      // Light theme
      const page2 = await context.newPage();
      await page2.goto(`${BASE_URL}/kid?as=${kidId}`, { waitUntil: 'networkidle' });
      await page2.waitForTimeout(500);
      await page2.screenshot({ path: path.join(screenshotsDir, `kid-preview-390x844-light.png`), fullPage: false });
      console.log('✓ kid-preview-390x844-light.png');
      await page2.close();

      // Dark theme
      const page3 = await context.newPage();
      await page3.addInitScript(() => {
        localStorage.setItem('mantine-color-scheme-value', 'dark');
      });
      await page3.goto(`${BASE_URL}/kid?as=${kidId}`, { waitUntil: 'networkidle' });
      await page3.waitForTimeout(500);
      await page3.screenshot({ path: path.join(screenshotsDir, `kid-preview-390x844-dark.png`), fullPage: false });
      console.log('✓ kid-preview-390x844-dark.png');
      await page3.close();
    } catch (e) {
      console.error(`✗ Kid preview: ${e.message}`);
    } finally {
      await context.close();
    }
  }

  // Bell screenshot (1280x800)
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    try {
      await loginUI(page);

      for (const theme of ['light', 'dark']) {
        const page2 = await context.newPage();
        try {
          if (theme === 'dark') {
            await page2.addInitScript(() => {
              localStorage.setItem('mantine-color-scheme-value', 'dark');
            });
          }

          await page2.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
          await page2.waitForTimeout(500);

          // Click the bell icon to open it
          const bellBtn = await page2.$('button[aria-label*="bell"], button[aria-label*="notification"], [role="button"][aria-label*="Bell"]');
          if (bellBtn) {
            await bellBtn.click();
            await page2.waitForTimeout(300);
          }

          await page2.screenshot({ path: path.join(screenshotsDir, `bell-1280x800-${theme}.png`), fullPage: false });
          console.log(`✓ bell-1280x800-${theme}.png`);
        } catch (e) {
          console.error(`✗ Bell ${theme}: ${e.message}`);
        } finally {
          await page2.close();
        }
      }
    } catch (e) {
      console.error(`✗ Bell setup: ${e.message}`);
    } finally {
      await context.close();
    }
  }

  await browser.close();
  console.log('\nScreenshots saved to:', screenshotsDir);
}

main().catch(console.error);
