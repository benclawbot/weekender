import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  const warnings = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

  console.log('=== Step 1: Navigate to swipe page ===');
  await page.goto('http://localhost:5173/swipe');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const url = page.url();
  console.log('URL:', url);

  // Check page structure
  const html = await page.content();
  console.log('\nPage title:', await page.title());

  // Find ALL elements
  const buttons = await page.locator('button').allTextContents();
  console.log('Buttons:', buttons);

  const headings = await page.locator('h1, h2, h3').allTextContents();
  console.log('Headings:', headings);

  const bodyText = await page.locator('body').innerText();
  console.log('\nPage text:\n', bodyText);

  // Check what's in the store / state
  const storeState = await page.evaluate(() => {
    // Try to find React state
    const root = document.querySelector('#root');
    if (!root) return 'No #root';
    return 'Root exists, checking children...';
  });
  console.log('\nDOM check:', storeState);

  // Check for card/swipe elements specifically
  const allDivs = await page.locator('div').count();
  console.log('Total divs:', allDivs);

  const classNames = await page.locator('[class]').evaluateAll(els =>
    [...new Set(els.map(el => el.className.split(' ')[0]))].slice(0, 30)
  );
  console.log('Unique class prefixes:', classNames);

  // Check if cards are loading
  const spinner = await page.locator('[class*="spinner"], [class*="loading"], [class*="animate"]').count();
  console.log('\nSpinner/loading elements:', spinner);

  // Network intercept
  console.log('\n=== Network requests ===');
  const networkReqs = [];
  page.on('request', req => {
    if (req.url().includes('/api')) networkReqs.push({ url: req.url(), method: req.method() });
  });
  page.on('response', res => {
    if (res.url().includes('/api')) {
      console.log(`  ${res.status()} ${res.url()}`);
    }
  });

  // Reload and capture
  await page.reload();
  await page.waitForTimeout(3000);

  console.log('\n=== Console Errors ===');
  if (errors.length === 0) console.log('No errors!');
  else errors.forEach(e => console.log('  ERROR:', e.slice(0, 200)));

  console.log('\n=== Console Warnings ===');
  if (warnings.length === 0) console.log('No warnings!');
  else warnings.slice(0, 5).forEach(w => console.log('  WARN:', w.slice(0, 200)));

  await browser.close();
}

test().catch(e => { console.error(e); process.exit(1); });
