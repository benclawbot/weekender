import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('=== Root Path Navigation Test ===\n');

  // Clear everything first
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(2000);

  const rootUrl = page.url();
  const rootText = await page.locator('body').innerText();
  console.log('After clear + reload on /:');
  console.log('  URL:', rootUrl);
  console.log('  Text:', rootText.slice(0, 200));

  // Now navigate to swipe
  await page.goto('http://localhost:5173/swipe');
  await page.waitForTimeout(2000);
  const swipeUrl = page.url();
  const swipeText = await page.locator('body').innerText();
  console.log('\nDirect /swipe:');
  console.log('  URL:', swipeUrl);
  console.log('  Text:', swipeText.slice(0, 200));

  // Check store state on swipe page
  const storeState = await page.evaluate(() => {
    const raw = localStorage.getItem('weekend-store');
    try { return JSON.parse(raw || '{}'); } catch { return null; }
  });
  console.log('\nPersisted store:', JSON.stringify(storeState, null, 2));

  // Check if there's a deck
  const deckInfo = await page.evaluate(() => {
    // Try to read the react state
    const root = document.getElementById('root');
    const text = root?.innerText || '';
    return { hasCards: text.includes('Discover'), hasAllDone: text.includes('All done') };
  });
  console.log('\nSwipe page state:', deckInfo);

  // Now test the full flow: from root, select canton, start
  console.log('\n=== Full Flow Test ===');
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1000);
  console.log('Setup URL:', page.url());
  const setupText = await page.locator('body').innerText();
  console.log('Setup text:', setupText.slice(0, 200));

  // Check for canton buttons
  const buttons = await page.locator('button').allTextContents();
  console.log('Buttons:', buttons);

  // Select a canton
  const geBtn = page.locator('button', { hasText: 'Genève' });
  if (await geBtn.count() > 0) {
    await geBtn.click();
    console.log('Clicked Genève');
  }

  // Click start
  const startBtn = page.locator('button', { hasText: /start/i });
  if (await startBtn.count() > 0) {
    await startBtn.click();
    await page.waitForURL('**/swipe', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log('After start - URL:', page.url());
    console.log('After start - Text:', (await page.locator('body').innerText()).slice(0, 300));
  }

  await browser.close();
}

test().catch(e => { console.error(e); process.exit(1); });