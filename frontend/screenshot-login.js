const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const outDir = '/tmp/claude-1000/-home-user-code-tskfrce/703677af-a608-4fd2-b15d-f5a67067416b/scratchpad/screenshots';

async function screenshots() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    // Light mode login
    const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const tab1 = await ctx1.newPage();
    await tab1.goto('http://127.0.0.1:3801/login', { waitUntil: 'networkidle' });
    await tab1.screenshot({ path: path.join(outDir, 'login-light.png') });
    console.log('Login light saved');
    
    // Toggle to dark mode and screenshot
    const buttons = await tab1.$$('button');
    let foundDarkToggle = false;
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text && text.includes('dark')) {
        await btn.click();
        foundDarkToggle = true;
        break;
      }
    }
    
    if (foundDarkToggle) {
      await tab1.waitForTimeout(300);
      await tab1.screenshot({ path: path.join(outDir, 'login-dark.png') });
      console.log('Login dark saved');
    }
    
    await ctx1.close();
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

screenshots().catch(console.error);
