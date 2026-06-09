import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const requests = [];
  const responses = [];

  page.on('request', req => {
    if (req.url().includes('/api')) {
      requests.push({ url: req.url(), method: req.method() });
    }
  });
  page.on('response', res => {
    if (res.url().includes('/api')) {
      responses.push({ url: res.url(), status: res.status() });
    }
  });

  await page.goto('http://localhost:5173/swipe');
  await page.waitForTimeout(1000);

  console.log('=== Proxy Test ===');
  console.log('Requests to /api:');
  requests.forEach(r => console.log(`  ${r.method} ${r.url}`));
  console.log('\nResponses:');
  responses.forEach(r => console.log(`  ${r.status} ${r.url}`));

  // Test proxy directly via fetch
  console.log('\n=== Direct Proxy Test ===');
  const proxyTest = await page.evaluate(async () => {
    const tests = [];

    // Test /api prefix
    try {
      const r1 = await fetch('/api/v1/health');
      tests.push({ url: '/api/v1/health', status: r1.status, ok: r1.ok });
    } catch (e) {
      tests.push({ url: '/api/v1/health', error: e.message });
    }

    // Test direct backend
    try {
      const r2 = await fetch('http://localhost:8000/api/v1/health');
      tests.push({ url: 'direct:8000/api/v1/health', status: r2.status, ok: r2.ok });
    } catch (e) {
      tests.push({ url: 'direct:8000/api/v1/health', error: e.message });
    }

    // Test activities via proxy
    try {
      const r3 = await fetch('/api/v1/activities?cantons=GE');
      const data = await r3.json();
      tests.push({ url: '/api/v1/activities?cantons=GE', status: r3.status, count: Array.isArray(data) ? data.length : 'N/A' });
    } catch (e) {
      tests.push({ url: '/api/v1/activities?cantons=GE', error: e.message });
    }

    return tests;
  });

  proxyTest.forEach(t => {
    if (t.error) console.log(`  ERROR ${t.url}: ${t.error}`);
    else console.log(`  ${t.status} ${t.url} (count: ${t.count ?? t.ok})`);
  });

  await browser.close();
}

test().catch(e => { console.error(e); process.exit(1); });
