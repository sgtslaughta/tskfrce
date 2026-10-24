import { chromium } from 'playwright';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3766';
const SHOT_DIR = '/tmp/claude-1000/-home-user-code-tskfrce/703677af-a608-4fd2-b15d-f5a67067416b/scratchpad/shots';

const screens = [
  { url: '/', name: 'today' },
  { url: '/devices', name: 'devices' },
  { url: '/kids', name: 'kids' },
  { url: '/chat', name: 'chat' },
  { url: '/settings', name: 'settings' },
  { url: '/more', name: 'more' },
  { url: '/login', name: 'login' },
  { url: '/setup', name: 'setup' },
  { url: '/nonexistent', name: '404' },
];

const viewports = [
  { width: 1280, height: 800, suffix: '1280' },
  { width: 390, height: 844, suffix: '390' },
];

const schemes = ['light', 'dark'];

async function screenshot() {
  const browser = await chromium.launch();
  
  try {
    for (const { url, name } of screens) {
      for (const { width, height, suffix } of viewports) {
        for (const scheme of schemes) {
          const context = await browser.newContext({
            viewport: { width, height },
            colorScheme: scheme,
          });
          const page = await context.newPage();
          
          try {
            const urlToVisit = `${BASE_URL}${url}`;
            await page.goto(urlToVisit, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(500);
            
            const filename = `${name}-${suffix}-${scheme}.png`;
            const filepath = path.join(SHOT_DIR, filename);
            await page.screenshot({ path: filepath });
            console.log(`✓ ${filename}`);
          } catch (e) {
            console.error(`✗ ${name}-${suffix}-${scheme}: ${e.message}`);
          } finally {
            await context.close();
          }
        }
      }
    }

    // Kid preview at 1280x800
    const kidContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      colorScheme: 'light',
    });
    const kidPage = await kidContext.newPage();
    try {
      await kidPage.goto(`${BASE_URL}/kid?as=1`, { waitUntil: 'networkidle', timeout: 30000 });
      await kidPage.waitForTimeout(500);
      await kidPage.screenshot({ path: path.join(SHOT_DIR, 'kid-1280-light.png') });
      console.log('✓ kid-1280-light.png');
    } catch (e) {
      console.error(`✗ kid-1280-light: ${e.message}`);
    } finally {
      await kidContext.close();
    }

    // Kid preview at 390x844
    const kidContext390 = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: 'light',
    });
    const kidPage390 = await kidContext390.newPage();
    try {
      await kidPage390.goto(`${BASE_URL}/kid?as=1`, { waitUntil: 'networkidle', timeout: 30000 });
      await kidPage390.waitForTimeout(500);
      await kidPage390.screenshot({ path: path.join(SHOT_DIR, 'kid-390-light.png') });
      console.log('✓ kid-390-light.png');
    } catch (e) {
      console.error(`✗ kid-390-light: ${e.message}`);
    } finally {
      await kidContext390.close();
    }
  } finally {
    await browser.close();
  }
}

screenshot().catch(console.error);
