import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:8000/api/v1';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  // 1. Go to home/setup
  console.log('=== Step 1: Setup Page ===');
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  const setupTitle = await page.textContent('h1, h2').catch(() => 'no heading');
  console.log('Heading:', setupTitle);

  const cantonButtons = await page.locator('button').allTextContents();
  console.log('Buttons found:', cantonButtons);

  // 2. Select canton(s) — click first available canton button
  const cantonBtns = page.locator('button');
  const count = await cantonBtns.count();
  console.log(`Found ${count} buttons`);

  // Click first 2 buttons (likely canton selections)
  for (let i = 0; i < Math.min(2, count); i++) {
    const text = await cantonBtns.nth(i).textContent();
    console.log(`  Button ${i}: "${text}"`);
    await cantonBtns.nth(i).click();
    await page.waitForTimeout(300);
  }

  // Find and click "Start" or "Swipe" button
  const allButtons = await page.locator('button').allTextContents();
  console.log('Buttons after selection:', allButtons);

  const startBtn = page.locator('button', { hasText: /start|begin|go|swipe/i });
  if (await startBtn.count() > 0) {
    await startBtn.first().click();
    console.log('Clicked start button');
  } else {
    console.log('No start button found, trying Enter key...');
    await page.keyboard.press('Enter');
  }

  await page.waitForTimeout(1000);
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  // 3. Navigate to swipe page
  console.log('\n=== Step 2: Swipe Page ===');
  await page.goto(`${BASE}/swipe`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const swipeUrl = page.url();
  console.log('Swipe URL:', swipeUrl);

  // Check page content
  const bodyText = await page.locator('body').innerText();
  console.log('Page text (first 500 chars):', bodyText.slice(0, 500));

  // Check for cards
  const cards = await page.locator('[class*="card"], .card, [data-testid*="card"]').count();
  console.log('Card elements found:', cards);

  // Check for swipe buttons
  const swipeActions = await page.locator('button').allTextContents();
  console.log('Swipe action buttons:', swipeActions);

  // Check network requests
  console.log('\n=== Step 3: API Health Check ===');
  const apiHealth = await page.evaluate(async (url) => {
    try {
      const res = await fetch(`${url}/health`);
      return await res.json();
    } catch (e) {
      return { error: e.message };
    }
  }, API);
  console.log('API Health:', apiHealth);

  // Check activities endpoint
  const activitiesRes = await page.evaluate(async (url) => {
    try {
      const res = await fetch(`${url}/activities?cantons=GE`);
      const data = await res.json();
      return { status: res.status, count: Array.isArray(data) ? data.length : 'not array', first: data[0]?.title || 'none' };
    } catch (e) {
      return { error: e.message };
    }
  }, API);
  console.log('Activities API:', activitiesRes);

  // Check events endpoint
  const eventsRes = await page.evaluate(async (url) => {
    try {
      const res = await fetch(`${url}/events?date_from=2026-06-09&date_to=2026-06-15&cantons=GE`);
      const data = await res.json();
      return { status: res.status, count: Array.isArray(data) ? data.length : 'not array' };
    } catch (e) {
      return { error: e.message };
    }
  }, API);
  console.log('Events API:', eventsRes);

  // Check basket endpoint
  const basketRes = await page.evaluate(async (url) => {
    try {
      const res = await fetch(`${url}/baskets`);
      return { status: res.status, ok: res.ok };
    } catch (e) {
      return { error: e.message };
    }
  }, API);
  console.log('Baskets API:', basketRes);

  // Console errors
  console.log('\n=== Step 4: Console Errors ===');
  if (errors.length === 0) {
    console.log('No console errors!');
  } else {
    errors.forEach((e, i) => console.log(`  Error ${i + 1}: ${e}`));
  }

  await browser.close();
  console.log('\n=== Done ===');
}

run().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
