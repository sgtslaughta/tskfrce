import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3766';
const SHOTS_DIR = '/tmp/claude-1000/-home-user-code-tskfrce/703677af-a608-4fd2-b15d-f5a67067416b/scratchpad/shots';

// Parent screens to screenshot
const SCREENS = [
  { path: '/', name: 'today' },
  { path: '/devices', name: 'devices' },
  { path: '/kids', name: 'kids' },
  { path: '/chat', name: 'chat' },
  { path: '/settings', name: 'settings' },
  { path: '/login', name: 'login' },
  { path: '/setup', name: 'setup' },
  { path: '/more', name: 'more' },
  { path: '/404-test', name: '404' },
];

const VIEWPORTS = [
  { width: 1280, height: 800, label: 'desktop' },
  { width: 390, height: 844, label: 'phone' },
];

const THEMES = ['light', 'dark'];

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

        // Log to check theme is applied
        page.on('console', (msg) => {
          if (msg.type() === 'error' || msg.type() === 'warning') {
            console.log(`[${msg.type()}] ${msg.text()}`);
          }
        });

        for (const screen of SCREENS) {
          try {
            let url = screen.path;

            // Special handling for non-authenticated pages
            if (!screen.path.startsWith('/login') && !screen.path.startsWith('/register') &&
                !screen.path.startsWith('/reset') && !screen.path.startsWith('/setup')) {
              // For authenticated pages, we need to ensure we're logged in
              // The dev server should have demo data
              const checkPage = await context.newPage();
              await checkPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
              const location = checkPage.url();
              await checkPage.close();

              if (location.includes('/login')) {
                console.log(`  Skipping ${screen.name} - not authenticated`);
                continue;
              }
            }

            // For 404, try a non-existent route
            if (screen.name === '404') {
              url = '/does-not-exist-page-xyz';
            }

            console.log(`  Screenshotting ${screen.name}...`);
            await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {
              // 404s will fail navigation, which is fine
            });

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

        // Screenshot kid preview if we can find a kid
        try {
          console.log(`  Screenshotting kid preview...`);
          // Try to get a kid ID from the API
          const kidPage = await context.newPage();
          await kidPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

          const kidId = await kidPage.evaluate(() => {
            const text = document.body.innerText;
            // Try to extract a kid ID - this is a fallback
            return 1; // Default kid ID
          });

          await kidPage.goto(`${BASE_URL}/kid?as=${kidId}`, { waitUntil: 'networkidle' });
          await kidPage.waitForTimeout(500);

          const kidFileName = `kid-${theme}-${viewport.label}.png`;
          const kidPath = path.join(SHOTS_DIR, kidFileName);
          await kidPage.screenshot({ path: kidPath, fullPage: false });
          console.log(`    ✓ Saved kid preview to ${kidFileName}`);

          await kidPage.close();
        } catch (e) {
          console.log(`    ✗ Kid preview error: ${e.message}`);
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
