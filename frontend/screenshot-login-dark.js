const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const outDir = '/tmp/claude-1000/-home-user-code-tskfrce/703677af-a608-4fd2-b15d-f5a67067416b/scratchpad/screenshots';

async function screenshots() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const tab = await ctx.newPage();
    
    // Set dark mode via localStorage
    await tab.goto('about:blank');
    await tab.evaluate(() => {
      localStorage.setItem('task4ce-color-scheme', 'dark');
    });
    
    await tab.goto('http://127.0.0.1:3801/login', { waitUntil: 'networkidle' });
    await tab.screenshot({ path: path.join(outDir, 'app-login-dark.png') });
    console.log('App login dark saved');
    
    await ctx.close();
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

screenshots().catch(console.error);
