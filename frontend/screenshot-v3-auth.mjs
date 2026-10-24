import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

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

async function loginAndScreenshot() {
  const browser = await chromium.launch();
  
  try {
    // First, log in and save cookies
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'demo-parent-1');
    await page.click('button:has-text("Log in")');
    
    // Wait for navigation to complete
    await page.waitForNavigation({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
    
    // Get cookies
    const cookies = await context.cookies();
    await context.close();
    
    console.log(`✓ Logged in, got ${cookies.length} cookies`);
    
    // Now take screenshots with the cookies
    for (const { url, name } of screens) {
      for (const { width, height, suffix } of viewports) {
        for (const scheme of schemes) {
          const newContext = await browser.newContext({
            viewport: { width, height },
            colorScheme: scheme,
          });
          
          // Add cookies
          if (cookies.length > 0) {
            await newContext.addCookies(cookies);
          }
          
          const newPage = await newContext.newPage();
          
          try {
            const urlToVisit = `${BASE_URL}${url}`;
            await newPage.goto(urlToVisit, { waitUntil: 'networkidle', timeout: 30000 });
            await newPage.waitForTimeout(500);
            
            const filename = `${name}-${suffix}-${scheme}.png`;
            const filepath = path.join(SHOT_DIR, filename);
            await newPage.screenshot({ path: filepath });
            console.log(`✓ ${filename}`);
          } catch (e) {
            console.error(`✗ ${name}-${suffix}-${scheme}: ${e.message}`);
          } finally {
            await newContext.close();
          }
        }
      }
    }

    // Kid preview at 1280x800
    const kidContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      colorScheme: 'light',
    });
    if (cookies.length > 0) {
      await kidContext.addCookies(cookies);
    }
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
    if (cookies.length > 0) {
      await kidContext390.addCookies(cookies);
    }
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

loginAndScreenshot().catch(console.error);
