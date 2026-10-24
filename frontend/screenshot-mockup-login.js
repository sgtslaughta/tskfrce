const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const outDir = '/tmp/claude-1000/-home-user-code-tskfrce/703677af-a608-4fd2-b15d-f5a67067416b/scratchpad/screenshots';

async function screenshots() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const tab = await ctx.newPage();
    
    await tab.goto('file:///home/user/code/tskfrce-redesign/docs/superpowers/specs/2026-10-24-v3-redesign-mockups/06-login.html', { waitUntil: 'networkidle' });
    await tab.screenshot({ path: path.join(outDir, 'mockup-login-light.png') });
    console.log('Mockup login light saved');
    
    // Toggle dark
    const buttons = await tab.$$('button');
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text && text.includes('Toggle dark')) {
        await btn.click();
        await tab.waitForTimeout(300);
        await tab.screenshot({ path: path.join(outDir, 'mockup-login-dark.png') });
        console.log('Mockup login dark saved');
        break;
      }
    }
    
    await ctx.close();
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

screenshots().catch(console.error);
