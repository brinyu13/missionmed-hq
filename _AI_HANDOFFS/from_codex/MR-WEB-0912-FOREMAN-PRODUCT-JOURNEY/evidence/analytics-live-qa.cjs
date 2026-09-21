const fs = require('fs');
const path = require('path');
const { chromium } = require('/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const origin = 'https://missionmedinstitute.com';
const routes = [
  '/mission-residency/?utm_source=foreman&utm_medium=qa&utm_campaign=final',
  '/product/match-prep-pro/?utm_source=foreman&utm_medium=qa&utm_campaign=final',
  '/product/iv-prep-masterclass/?utm_source=foreman&utm_medium=qa&utm_campaign=final',
  '/checkout/',
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const result = { generatedAt: new Date().toISOString(), routes: [] };
  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const analyticsRequests = [];
    page.on('request', request => {
      const url = request.url();
      if (/googletagmanager\.com|google-analytics\.com\/g\/collect/.test(url)) {
        const parsed = new URL(url);
        analyticsRequests.push({
          host: parsed.host,
          path: parsed.pathname,
          measurementId: parsed.searchParams.get('tid'),
          event: parsed.searchParams.get('en'),
          pageLocation: parsed.searchParams.get('dl'),
        });
      }
    });
    const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    result.routes.push({
      route,
      status: response && response.status(),
      dataLayerEvents: await page.evaluate(() => [...new Set((window.dataLayer || []).map(item => item && item.event).filter(Boolean))]),
      analyticsRequests,
    });
    await context.close();
  }
  await browser.close();
  const output = path.join(__dirname, 'ANALYTICS_LIVE_QA.json');
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
