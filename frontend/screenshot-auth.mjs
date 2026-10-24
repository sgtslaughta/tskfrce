import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3766';
const SHOTS_DIR = '/tmp/claude-1000/-home-user-code-tskfrce/703677af-a608-4fd2-b15d-f5a67067416b/scratchpad/shots';

// Parent screens to screenshot
const SCREENS = [
  { path: '/', name: 'today', auth: true },
  { path: '/devices', name: 'devices', auth: true },
  { path: '/kids', name: 'kids', auth: true },
  { path: '/chat', name: 'chat', auth: true },
  { path: '/settings', name: 'settings', auth: true },
  { path: '/login', name: 'login', auth: false },
  { path: '/setup', name: 'setup', auth: false },
  { path: '/more', name: 'more', auth: true },
  { path: '/does-not-exist-page-xyz', name: '404', auth: true },
];

const VIEWPORTS = [
  { width: 1280, height: 800, label: 'desktop' },
  { width: 390, height: 844, label: 'phone' },
];

const THEMES = ['light', 'dark'];

async function login(page) {
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 10000 });

    // Wait for form to be visible
    await page.waitForSelector('#username', { timeout: 5000 });

    // Fill in login form using ID selectors
    await page.fill('#username', 'admin');
    await page.fill('#password', 'demo-parent-1');

    // Click login button - find submit button
    const submitButton = await page.$('button[type="submit"]');
    if (!submitButton) {
      throw new Error('Submit button not found');
    }

    // Click and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }),
      submitButton.click()
    ]);

    const location = page.url();
    if (location.includes('/login')) {
      console.log('    ✗ Login failed - still on login page');
      return false;
    }

    console.log('    ✓ Login successful');
    return true;
  } catch (e) {
    console.log(`    ✗ Login error: ${e.message}`);
    return false;
  }
}

async function takeScreenshots() {
  const browser = await chromium.launch();

  try {
    // Create shots directory if needed
    if (!fs.existsSync(SHOTS_DIR)) {
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
    }

    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        console.log(`\n=== ${theme} mode, ${viewport.label} (${viewport.width}x${viewport.height}) ===`);

        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: theme,
        });

        const page = await context.newPage();

        // Suppress console errors
        page.on('console', (msg) => {
          // Ignore
        });

        let authenticated = false;

        for (const screen of SCREENS) {
          try {
            // Log in if needed
            if (screen.auth && !authenticated) {
              console.log(`  Logging in...`);
              authenticated = await login(page);
              if (!authenticated) {
                console.log(`  Skipping ${screen.name} - login failed`);
                continue;
              }
            }

            let url = screen.path;

            console.log(`  Screenshotting ${screen.name}...`);

            try {
              await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle', timeout: 10000 });
            } catch (e) {
              // 404s and error pages may fail navigation
              if (!screen.name.includes('404') && !screen.name.includes('error')) {
                throw e;
              }
            }

            // Wait a bit for animations to settle
            await page.waitForTimeout(500);

            const fileName = `${screen.name}-${theme}-${viewport.label}.png`;
            const filePath = path.join(SHOTS_DIR, fileName);

            await page.screenshot({ path: filePath, fullPage: false });
            console.log(`    ✓ Saved to ${fileName}`);
          } catch (e) {
            console.log(`    ✗ Error: ${e.message}`);
          }
        }

        // Screenshot kid preview if authenticated
        if (authenticated) {
          try {
            console.log(`  Screenshotting kid preview...`);
            await page.goto(`${BASE_URL}/kid?as=1`, { waitUntil: 'networkidle', timeout: 10000 });
            await page.waitForTimeout(500);

            const kidFileName = `kid-${theme}-${viewport.label}.png`;
            const kidPath = path.join(SHOTS_DIR, kidFileName);
            await page.screenshot({ path: kidPath, fullPage: false });
            console.log(`    ✓ Saved kid preview to ${kidFileName}`);
          } catch (e) {
            console.log(`    ✗ Kid preview error: ${e.message}`);
          }
        }

        await context.close();
      }
    }

    console.log('\n✓ All screenshots complete');
  } finally {
    await browser.close();
  }
}

takeScreenshots().catch(console.error);
