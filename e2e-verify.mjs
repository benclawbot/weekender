import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));

  console.log('=== E2E Verification: Setup → Swipe → Vote ===\n');

  // 1. Setup page
  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');
  console.log('✓ Setup page loaded');

  // 2. Select canton
  await page.locator('button', { hasText: 'Vaud' }).click();
  console.log('✓ Selected Vaud canton');

  // 3. Start swiping
  await page.locator('button', { hasText: /start swiping/i }).click();
  await page.waitForURL('**/swipe', { timeout: 15000 });
  console.log('✓ Navigated to swipe page');

  // 4. Verify cards are shown
  await page.waitForTimeout(2000);
  const text = await page.locator('body').innerText();
  const hasCards = text.includes('Discover') && (text.includes('Vaud') || text.includes('Genève'));
  console.log(hasCards ? '✓ Cards are visible' : '✗ Cards NOT visible');

  // 5. Check card content
  const cardCount = (text.match(/📍/g) || []).length;
  console.log(`✓ Found ${cardCount} cards with location info`);

  // 6. Click pass button
  const passBtn = page.locator('button[aria-label="Pass"]');
  if (await passBtn.count() > 0) {
    await passBtn.click();
    console.log('✓ Clicked Pass button');
  }

  // 7. Click basket button
  const basketBtn = page.locator('button[aria-label="Basket"]');
  if (await basketBtn.count() > 0) {
    await basketBtn.click();
    console.log('✓ Clicked Basket button');
  }

  // 8. Click favourite button
  const favBtn = page.locator('button[aria-label="Favourite"]');
  if (await favBtn.count() > 0) {
    await favBtn.click();
    console.log('✓ Clicked Favourite button');
  }

  await page.waitForTimeout(1000);

  // 9. Check basket count
  const basketBtn2 = page.locator('button', { hasText: /basket/i });
  const basketText = await basketBtn2.first().textContent().catch(() => '');
  console.log(basketText.includes('2') ? '✓ Basket shows 2 items' : '⚠ Basket count unclear');

  // 10. Go to basket page
  await page.locator('button', { hasText: /basket/i }).first().click();
  await page.waitForTimeout(1000);
  const basketUrl = page.url();
  console.log(basketUrl.includes('/basket') ? '✓ Navigated to basket page' : '⚠ Basket navigation issue');

  console.log('\n=== Errors ===');
  if (errors.length === 0) console.log('✓ No errors!');
  else errors.forEach(e => console.log('  ✗', e.slice(0, 200)));

  await browser.close();
  console.log('\n=== Test Complete ===');
}

test().catch(e => { console.error(e); process.exit(1); });