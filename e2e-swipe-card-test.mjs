import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push({ text: msg.text(), loc: msg.location() });
  });
  page.on('pageerror', err => errors.push({ text: 'PAGE_ERR: ' + err.message, loc: 'unknown' }));

  console.log('=== Test: Setup → Swipe ===\n');

  // Go to setup page
  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');

  // Select canton
  await page.locator('button', { hasText: 'Genève' }).click();
  await page.waitForTimeout(300);

  // Clear any previous session data
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Select canton again after clear
  await page.locator('button', { hasText: 'Genève' }).click();
  await page.waitForTimeout(200);

  // Intercept ALL responses to debug
  page.on('response', res => {
    if (res.url().includes('/api/')) {
      console.log(`  API ${res.status()}: ${res.url().replace('http://localhost:5173', '')}`);
    }
  });

  // Click start and capture what happens
  console.log('\nClicking start...');
  const [dialog] = await Promise.all([
    page.waitForEvent('dialog', { timeout: 10000 }).catch(() => null),
    page.locator('button', { hasText: /start swiping/i }).click(),
  ]);

  if (dialog) {
    console.log('Alert:', await dialog.message());
    await dialog.dismiss();
    await page.waitForTimeout(500);
  }

  await page.waitForTimeout(2000);
  console.log('URL:', page.url());

  const text = await page.locator('body').innerText();
  console.log('Content:', text.slice(0, 300));

  console.log('\n=== All Errors ===');
  errors.forEach(e => console.log(' ', e.text.slice(0, 200)));

  // Check React tree
  console.log('\n=== React Debug ===');
  const reactDebug = await page.evaluate(() => {
    const root = document.getElementById('root');
    // Check if there are any img elements with failed src
    const imgs = document.querySelectorAll('img');
    const imgStates = Array.from(imgs).map(img => ({
      src: img.src.slice(0, 50),
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      error: img.error
    }));

    // Check store from localStorage
    const storeData = localStorage.getItem('weekend-store');
    let parsed = null;
    try { parsed = JSON.parse(storeData || '{}'); } catch {}

    return {
      imgCount: imgs.length,
      imgStates: imgStates.slice(0, 3),
      storeHasDeck: !!parsed,
      storeKeys: parsed ? Object.keys(parsed) : [],
    };
  });
  console.log('React debug:', JSON.stringify(reactDebug, null, 2));

  await browser.close();
}

test().catch(e => { console.error(e); process.exit(1); });