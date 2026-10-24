const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const outDir = '/tmp/claude-1000/-home-user-code-tskfrce/703677af-a608-4fd2-b15d-f5a67067416b/scratchpad/screenshots';

async function screenshots() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    // Dark mode context
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'dark'
    });
    const tab = await ctx.newPage();
    
    await tab.goto('http://127.0.0.1:3801/login', { waitUntil: 'networkidle' });
    await tab.screenshot({ path: path.join(outDir, 'app-login-dark.png') });
    console.log('App login dark (context) saved');
    
    await ctx.close();
    
    // Also try with light mode for comparison
    const ctx2 = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'light'
    });
    const tab2 = await ctx2.newPage();
    
    await tab2.goto('http://127.0.0.1:3801/login', { waitUntil: 'networkidle' });
    await tab2.screenshot({ path: path.join(outDir, 'app-login-light.png') });
    console.log('App login light (context) saved');
    
    await ctx2.close();
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

screenshots().catch(console.error);
