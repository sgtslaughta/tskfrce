const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const outDir = '/tmp/claude-1000/-home-user-code-tskfrce/703677af-a608-4fd2-b15d-f5a67067416b/scratchpad/screenshots';

async function debug() {
  const browser = await chromium.launch({ headless: false }); // headless false for debugging
  
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const tab = await context.newPage();
    
    // Log console messages
    tab.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await tab.goto('http://127.0.0.1:3801', { waitUntil: 'networkidle' });
    
    // Wait for login and log in
    const inputs = await tab.$$('input');
    if (inputs.length >= 2) {
      await inputs[0].fill('admin');
      await inputs[1].fill('demo-parent-1');
    }
    
    const buttons = await tab.$$('button');
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text && text.includes('Log in')) {
        await btn.click();
        break;
      }
    }
    
    await tab.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await tab.waitForTimeout(1000);
    
    // Check for icon rendering issues
    const icons = await tab.$$('.ms');
    console.log(`Found ${icons.length} icon elements`);
    
    if (icons.length > 0) {
      const firstIcon = icons[0];
      const content = await firstIcon.textContent();
      const computed = await tab.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          content: el.textContent,
          fontFamily: style.fontFamily,
          display: style.display
        };
      }, firstIcon);
      
      console.log('First icon details:', computed);
    }
    
    const file = path.join(outDir, 'debug-screenshot.png');
    await tab.screenshot({ path: file });
    console.log(`Saved: ${file}`);
    
    await context.close();
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
