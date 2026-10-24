import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = '/tmp/claude-1000/-home-user-code-tskfrce/703677af-a608-4fd2-b15d-f5a67067416b/scratchpad/shots';

const BASE_URL = 'http://127.0.0.1:3766';
const VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '390x844', width: 390, height: 844 }
];
const THEMES = ['light', 'dark'];

const screenshots = [];

async function screenshot(page, name) {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    
    for (const theme of THEMES) {
      if (theme === 'dark') {
        await page.evaluate(() => {
          document.documentElement.classList.add('dark');
          localStorage.setItem('task4ce-color-scheme', 'dark');
          document.documentElement.setAttribute('data-mantine-color-scheme', 'dark');
        });
      } else {
        await page.evaluate(() => {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('task4ce-color-scheme', 'light');
          document.documentElement.setAttribute('data-mantine-color-scheme', 'light');
        });
      }
      
      await page.waitForTimeout(200);
      const filename = `${name}-${viewport.name}-${theme}.png`;
      const filepath = path.join(SHOTS_DIR, filename);
      await page.screenshot({ path: filepath, fullPage: false });
      screenshots.push(filename);
      console.log(`✓ ${filename}`);
    }
  }
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const consoleErrors = [];
  const pageErrors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });
  
  try {
    // Login
    console.log('Logging in...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('#username', 'admin');
    await page.fill('#password', 'demo-parent-1');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ timeout: 10000 });
    
    console.log('✓ Logged in');
    
    // Get kid IDs
    console.log('Fetching kid IDs...');
    await page.goto(`${BASE_URL}/kids`, { waitUntil: 'networkidle' });
    const kidLinks = await page.$$eval('a', links => 
      links
        .map(link => {
          const href = link.getAttribute('href');
          if (href && href.includes('/kid?')) {
            const url = new URL(href, 'http://localhost');
            return url.searchParams.get('as');
          }
          return null;
        })
        .filter(Boolean)
    ).catch(() => []);
    
    const kidId = kidLinks[0] || 'demo-kid-1';
    console.log(`✓ Found kid ID: ${kidId}`);
    
    // Parent screens
    const screens = [
      { path: '/', name: 'today' },
      { path: '/kids', name: 'kids' },
      { path: '/devices', name: 'devices' },
      { path: '/chat', name: 'chat' },
      { path: '/settings', name: 'settings' },
      { path: '/more', name: 'more' },
      { path: '/login', name: 'login' },
      { path: '/404', name: 'not-found' }
    ];
    
    for (const screen of screens) {
      console.log(`\nScreenshotting ${screen.name}...`);
      try {
        await page.goto(`${BASE_URL}${screen.path}`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(300);
        await screenshot(page, screen.name);
      } catch (e) {
        console.log(`⚠ Error on ${screen.name}: ${e.message}`);
      }
    }
    
    // Kid preview
    console.log(`\nScreenshotting kid preview...`);
    await page.goto(`${BASE_URL}/kid?as=${kidId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await screenshot(page, 'kid-preview');
    
    // Report errors
    console.log('\n=== ERRORS ===');
    if (consoleErrors.length > 0) {
      console.log('Console errors:');
      consoleErrors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('✓ No console errors');
    }
    
    if (pageErrors.length > 0) {
      console.log('Page errors:');
      pageErrors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('✓ No page errors');
    }
    
  } catch (err) {
    console.error('Script error:', err);
  } finally {
    await browser.close();
  }
  
  console.log(`\n=== COMPLETE ===`);
  console.log(`${screenshots.length} screenshots saved`);
}

main();
