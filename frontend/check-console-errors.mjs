import { chromium } from 'playwright';

const BASE_URL = 'http://127.0.0.1:3766';

async function checkConsoleErrors() {
  const browser = await chromium.launch();
  const errors = [];
  
  const context = await browser.newContext({ 
    viewport: { width: 1280, height: 800 },
    colorScheme: 'light'
  });
  const page = await context.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({ route: 'unknown', msg: msg.text() });
    }
  });
  
  page.on('pageerror', err => {
    errors.push({ route: 'unknown', msg: err.message });
  });
  
  const routes = ['/', '/devices', '/kids', '/chat', '/settings', '/login'];
  for (const route of routes) {
    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 15000 });
      console.log(`✓ ${route}`);
    } catch (e) {
      console.log(`⚠ ${route}: ${e.message}`);
    }
  }
  
  await context.close();
  await browser.close();
  
  return errors;
}

checkConsoleErrors().then(errors => {
  if (errors.length === 0) {
    console.log('\n✓ No console errors found');
    process.exit(0);
  } else {
    console.log(`\n✗ Found ${errors.length} console error(s):`);
    errors.forEach(e => {
      console.log(`  ${e.msg}`);
    });
    process.exit(1);
  }
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(2);
});
