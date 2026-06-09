import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  console.log('=== Targeted Debug ===\n');

  // Clear localStorage and go to swipe directly
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => localStorage.clear());

  // Set up store with a small deck (simulate successful load)
  await page.evaluate(() => {
    const testActivities = [
      { id: '1', title: 'Test Activity 1', type: 'evergreen', canton: 'GE', address: 'Test', tags: ['family'], photo_url: null },
      { id: '2', title: 'Test Activity 2', type: 'evergreen', canton: 'GE', address: 'Test', tags: ['outdoor'], photo_url: null },
      { id: '3', title: 'Test Activity 3', type: 'evergreen', canton: 'GE', address: 'Test', tags: ['nature'], photo_url: null },
    ];
    localStorage.setItem('weekend-store', JSON.stringify({
      state: {
        deck: testActivities,
        deckIndex: 0,
        currentBasket: [],
        activeCantons: ['GE'],
        dateFrom: '2026-06-13',
        dateTo: '2026-06-14',
      },
      version: 0
    }));
  });

  await page.goto('http://localhost:5173/swipe');
  await page.waitForTimeout(3000);

  const url = page.url();
  const text = await page.locator('body').innerText();
  console.log('URL:', url);
  console.log('Body text:', text.slice(0, 300));

  console.log('\n=== Errors ===');
  errors.forEach(e => console.log(' ', e.slice(0, 300)));

  // Check DOM structure
  const rootHTML = await page.locator('#root').innerHTML();
  console.log('\nRoot innerHTML (first 500):', rootHTML.slice(0, 500));

  await browser.close();
}

test().catch(e => { console.error(e); process.exit(1); });