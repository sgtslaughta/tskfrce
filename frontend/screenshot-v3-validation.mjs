import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://127.0.0.1:3766';
const OUTPUT_DIR = '/tmp/claude-1000/-home-user-code-tskfrce/703677af-a608-4fd2-b15d-f5a67067416b/scratchpad/shots';

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

  const routes = [
    { path: '/', label: 'today' },
    { path: '/devices', label: 'devices' },
    { path: '/kids', label: 'kids' },
    { path: '/chat', label: 'chat' },
    { path: '/settings', label: 'settings' },
    { path: '/login', label: 'login' },
    { path: '/setup', label: 'setup' },
    { path: '/more', label: 'more' },
    { path: '/__test_404__', label: '404' }
  ];

  for (const size of sizes) {
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });

    for (const route of routes) {
      for (const theme of ['light', 'dark']) {
        const page = await context.newPage();

        try {
          // Set theme preference if dark
          if (theme === 'dark') {
            await page.addInitScript(() => {
              localStorage.setItem('mantine-color-scheme-value', 'dark');
            });
          }

          await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 30000 });

          // Wait a moment for animations/rendering
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
      // Get a kid ID from the API
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      // Try to find a kid ID by looking at the page
      const kidId = await page.evaluate(() => {
        const kidElements = document.querySelectorAll('[data-kid-id]');
        if (kidElements.length > 0) {
          return kidElements[0].getAttribute('data-kid-id');
        }
        return '1'; // fallback
      });

      // Light theme
      await page.goto(`${BASE_URL}/kid?as=${kidId}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(screenshotsDir, `kid-preview-390x844-light.png`), fullPage: false });
      console.log('✓ kid-preview-390x844-light.png');

      // Dark theme
      await page.addInitScript(() => {
        localStorage.setItem('mantine-color-scheme-value', 'dark');
      });
      await page.goto(`${BASE_URL}/kid?as=${kidId}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(screenshotsDir, `kid-preview-390x844-dark.png`), fullPage: false });
      console.log('✓ kid-preview-390x844-dark.png');
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
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      // Click the bell icon to open it
      const bellBtn = await page.$('button[aria-label*="bell"], button[aria-label*="notification"]');
      if (bellBtn) {
        await bellBtn.click();
        await page.waitForTimeout(300);
      }

      // Light theme
      await page.screenshot({ path: path.join(screenshotsDir, `bell-1280x800-light.png`), fullPage: false });
      console.log('✓ bell-1280x800-light.png');

      // Dark theme
      await page.addInitScript(() => {
        localStorage.setItem('mantine-color-scheme-value', 'dark');
      });
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const bellBtn2 = await page.$('button[aria-label*="bell"], button[aria-label*="notification"]');
      if (bellBtn2) {
        await bellBtn2.click();
        await page.waitForTimeout(300);
      }
      await page.screenshot({ path: path.join(screenshotsDir, `bell-1280x800-dark.png`), fullPage: false });
      console.log('✓ bell-1280x800-dark.png');
    } catch (e) {
      console.error(`✗ Bell: ${e.message}`);
    } finally {
      await context.close();
    }
  }

  await browser.close();
  console.log('\nScreenshots saved to:', screenshotsDir);
}

main().catch(console.error);
