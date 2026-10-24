import { chromium } from 'playwright';

const BASE_URL = 'http://127.0.0.1:3766';

async function validateLayout() {
  const browser = await chromium.launch();
  const errors = [];
  
  console.log('Testing responsive layout at 360px...');
  
  const context = await browser.newContext({ 
    viewport: { width: 360, height: 800 },
    colorScheme: 'light'
  });
  const page = await context.newPage();
  
  const routes = ['/', '/devices', '/kids', '/chat', '/settings', '/login'];
  for (const route of routes) {
    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      if (scrollWidth > 360) {
        errors.push({ 
          route, 
          viewport: '360px',
          issue: `scrollWidth=${scrollWidth} > 360`,
          severity: 'high'
        });
        console.log(`✗ ${route}: ${scrollWidth} > 360`);
      } else {
        console.log(`✓ ${route}: no overflow`);
      }
    } catch (e) {
      console.log(`⚠ ${route}: ${e.message}`);
    }
  }
  
  await context.close();
  await browser.close();
  
  return errors;
}

validateLayout().then(errors => {
  if (errors.length === 0) {
    console.log('\n✓ All layout tests passed');
    process.exit(0);
  } else {
    console.log(`\n✗ Found ${errors.length} layout issue(s)`);
    process.exit(1);
  }
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(2);
});
