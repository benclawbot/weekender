import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('=== Store Diagnostic ===\n');

  // First, check what's in localStorage from previous sessions
  await page.goto('http://localhost:5173/');

  const storeData = await page.evaluate(() => {
    const raw = localStorage.getItem('weekend-store');
    try {
      return JSON.parse(raw || '{}');
    } catch {
      return null;
    }
  });
  console.log('Persisted store:', JSON.stringify(storeData, null, 2));

  // Check what zustand default state is
  const defaults = await page.evaluate(() => {
    // Reconstruct what the initial state should be
    return {
      dateFrom: '',
      dateTo: '',
      activeCantons: ['GE', 'VD', 'FR', 'VS', 'JU'],
      deck: [],
      deckIndex: 0,
      currentBasket: [],
    };
  });
  console.log('\nDefault state:', defaults);

  // Now check what the store ACTUALLY has after hydration
  const actualStore = await page.evaluate(() => {
    // Try to read from zustand directly
    const keys = Object.keys(localStorage).filter(k => k.includes('weekend') || k.includes('store'));
    return { keys, store: localStorage.getItem('weekend-store') };
  });
  console.log('\nActual localStorage keys:', actualStore.keys);
  console.log('Store content:', actualStore.store);

  // Check if deck is empty by looking at swipe page
  await page.goto('http://localhost:5173/swipe');
  await page.waitForTimeout(2000);
  const swipeText = await page.locator('body').innerText();
  console.log('\nSwipe page text:', swipeText.slice(0, 200));

  // Try clearing and reloading
  console.log('\n=== After Clear ===');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(2000);

  const setupText = await page.locator('body').innerText();
  console.log('Setup page after clear:', setupText.slice(0, 200));

  await browser.close();
}

test().catch(e => { console.error(e); process.exit(1); });