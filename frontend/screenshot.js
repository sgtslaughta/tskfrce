const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const outDir = '/tmp/claude-1000/-home-user-code-tskfrce/703677af-a608-4fd2-b15d-f5a67067416b/scratchpad/screenshots';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });

  try {
    const viewports = [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 390, height: 844 }
    ];

    // Capture mockups
    const pages = [
      { name: '01-parent-today', url: 'file:///home/user/code/tskfrce-redesign/docs/superpowers/specs/2026-10-24-v3-redesign-mockups/01-parent-today.html' },
      { name: '04-parent-phone', url: 'file:///home/user/code/tskfrce-redesign/docs/superpowers/specs/2026-10-24-v3-redesign-mockups/04-parent-phone.html' }
    ];

    for (const page of pages) {
      for (const viewport of viewports) {
        const context = await browser.newContext({ viewport });
        const tab = await context.newPage();
        
        await tab.goto(page.url, { waitUntil: 'networkidle' });
        
        // Take light mode screenshot
        const lightFile = path.join(outDir, `mockup-${page.name}-${viewport.name}-light.png`);
        await tab.screenshot({ path: lightFile });
        console.log(`Saved mockup: ${lightFile}`);

        // Take dark mode screenshot
        try {
          const buttons = await tab.$$('button');
          for (const btn of buttons) {
            const text = await btn.textContent();
            if (text && text.includes('Toggle dark')) {
              await btn.click();
              await tab.waitForTimeout(300);
              const darkFile = path.join(outDir, `mockup-${page.name}-${viewport.name}-dark.png`);
              await tab.screenshot({ path: darkFile });
              console.log(`Saved mockup: ${darkFile}`);
              break;
            }
          }
        } catch(e) {
          console.log(`No dark toggle for ${page.name}`);
        }

        await context.close();
      }
    }

    // Capture app with login
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const tab = await context.newPage();
      
      await tab.goto('http://127.0.0.1:3801', { waitUntil: 'networkidle' });
      
      // Wait for login form
      try {
        await tab.waitForSelector('input', { timeout: 3000 });
        
        // Fill login form
        const inputs = await tab.$$('input');
        if (inputs.length >= 2) {
          await inputs[0].fill('admin');
          await inputs[1].fill('demo-parent-1');
        }
        
        // Click login button
        const buttons = await tab.$$('button');
        for (const btn of buttons) {
          const text = await btn.textContent();
          if (text && text.includes('Log in')) {
            await btn.click();
            break;
          }
        }
        
        // Wait for navigation
        await tab.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
        await tab.waitForTimeout(1500);
      } catch(e) {
        console.log(`Login failed: ${e.message}`);
      }
      
      // Take screenshot
      const lightFile = path.join(outDir, `app-today-${viewport.name}-light.png`);
      await tab.screenshot({ path: lightFile });
      console.log(`Saved app: ${lightFile}`);

      await context.close();
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

takeScreenshots().catch(console.error);
