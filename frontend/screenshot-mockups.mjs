import { chromium } from 'playwright';
import path from 'path';

const MOCKUP_DIR = '/home/user/code/tskfrce-v3a/docs/superpowers/specs/2026-10-24-v3-redesign-mockups';
const SHOT_DIR = '/tmp/claude-1000/-home-user-code-tskfrce/703677af-a608-4fd2-b15d-f5a67067416b/scratchpad/shots';

const mockups = [
  { file: '01-parent-today.html', name: 'mockup-01-today' },
  { file: '02-parent-screens.html', name: 'mockup-02-screens' },
  { file: '04-parent-phone.html', name: 'mockup-04-phone' },
  { file: '05-states.html', name: 'mockup-05-states' },
  { file: '06-login.html', name: 'mockup-06-login' },
  { file: '07-setup.html', name: 'mockup-07-setup' },
  { file: '08-kid-phone.html', name: 'mockup-08-kid' },
];

async function screenshot() {
  const browser = await chromium.launch();
  
  try {
    for (const { file, name } of mockups) {
      const mockupPath = `file://${MOCKUP_DIR}/${file}`;
      
      // Desktop 1280x800
      const context1280 = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        colorScheme: 'light',
      });
      const page1280 = await context1280.newPage();
      try {
        await page1280.goto(mockupPath, { waitUntil: 'load', timeout: 30000 });
        await page1280.waitForTimeout(800);
        const filename = `${name}-1280.png`;
        const filepath = path.join(SHOT_DIR, filename);
        await page1280.screenshot({ path: filepath });
        console.log(`✓ ${filename}`);
      } catch (e) {
        console.error(`✗ ${name}-1280: ${e.message}`);
      } finally {
        await context1280.close();
      }

      // Phone 390x844
      const context390 = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: 'light',
      });
      const page390 = await context390.newPage();
      try {
        await page390.goto(mockupPath, { waitUntil: 'load', timeout: 30000 });
        await page390.waitForTimeout(800);
        const filename = `${name}-390.png`;
        const filepath = path.join(SHOT_DIR, filename);
        await page390.screenshot({ path: filepath });
        console.log(`✓ ${filename}`);
      } catch (e) {
        console.error(`✗ ${name}-390: ${e.message}`);
      } finally {
        await context390.close();
      }
    }
  } finally {
    await browser.close();
  }
}

screenshot().catch(console.error);
