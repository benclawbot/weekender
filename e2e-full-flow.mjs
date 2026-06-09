import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  console.log('=== Full User Flow Test ===\n');

  // Step 1: Home/Setup page
  console.log('1. Setup Page');
  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');
  const h1 = await page.locator('h1').first().textContent();
  console.log('   Heading:', h1);

  // Select canton(s)
  await page.locator('button', { hasText: 'Genève' }).click();
  await page.waitForTimeout(200);

  // Step 2: Click Start Swiping
  console.log('\n2. Starting swipe flow...');
  await page.locator('button', { hasText: /start swiping/i }).click();

  // Wait for navigation or error
  await page.waitForTimeout(3000);

  const afterStartUrl = page.url();
  console.log('   URL after start:', afterStartUrl);

  const afterStartText = await page.locator('body').innerText();
  console.log('   Page content:', afterStartText.slice(0, 300));

  // Check for alert/error
  const alert = await page.locator('[role="alert"], .alert').count();
  console.log('   Alerts:', alert);

  // Check for dialogs
  try {
    await page.locator('dialog').waitFor({ timeout: 1000 });
    console.log('   Dialog found!');
  } catch {}

  // Check network activity during load
  console.log('\n3. Checking for failed requests...');
  const failedRequests = [];
  page.on('requestfailed', req => {
    failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  // Step 3: Reload and check if swipe page has cards
  await page.reload();
  await page.waitForTimeout(2000);
  console.log('   After reload URL:', page.url());
  const afterReloadText = await page.locator('body').innerText();
  console.log('   After reload:', afterReloadText.slice(0, 200));

  // Step 4: Manual setup
  console.log('\n4. Manual setup flow...');
  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');

  // Intercept API calls
  const apiCalls = [];
  page.on('response', res => {
    if (res.url().includes('/api/')) {
      apiCalls.push({ url: res.url(), status: res.status() });
    }
  });

  await page.locator('button', { hasText: 'Genève' }).click();
  await page.locator('button', { hasText: 'Vaud' }).click();

  // Check if dates are set
  const dateInputs = await page.locator('input[type="date"]').count();
  console.log('   Date inputs:', dateInputs);

  console.log('\n   Starting...');
  await page.locator('button', { hasText: /start/i }).click();

  // Wait for either /swipe navigation or error
  await page.waitForURL('**/swipe', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const finalUrl = page.url();
  const finalText = await page.locator('body').innerText();
  console.log('   Final URL:', finalUrl);
  console.log('   Final text:', finalText.slice(0, 300));

  console.log('\n   API calls made:');
  apiCalls.forEach(a => console.log(`     ${a.status} ${a.url}`));

  console.log('\n   Errors:');
  if (errors.length === 0) console.log('     None!');
  else errors.forEach(e => console.log('     ', e.slice(0, 200)));

  await browser.close();
}

test().catch(e => { console.error(e); process.exit(1); });
