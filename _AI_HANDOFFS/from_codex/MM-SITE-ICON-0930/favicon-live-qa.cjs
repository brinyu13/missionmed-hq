const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const origin = 'https://missionmedinstitute.com';
const routes = [
  ['homepage', '/', 'MissionMed'],
  ['mission_residency', '/mission-residency/', 'Interview Bootcamp Week'],
  ['exam_prep', '/examprep/', 'ExamPrep'],
  ['usce', '/usce/', 'USCE'],
  ['arena_landing', '/homepage-arena/', 'Arena'],
  ['arena', '/arena/', 'MissionMed Arena'],
  ['account', '/my-account/', 'My Account'],
  ['login', '/wp-login.php', 'WordPress'],
];

const expectedAssets = {
  '/favicon.ico': 'e6c3dc8c741c5de7a7985af2e2641b0a6f36df50fd80f49495c58db99d095327',
  '/wp-content/mu-plugins/missionmed-site-icon-assets/favicon.ico': 'e6c3dc8c741c5de7a7985af2e2641b0a6f36df50fd80f49495c58db99d095327',
  '/wp-content/mu-plugins/missionmed-site-icon-assets/missionmed-favicon-16.png': '07f37890a7446b6a21c7e568b9a1c2121f2671dd363e896835a8bed5585ba507',
  '/wp-content/mu-plugins/missionmed-site-icon-assets/missionmed-favicon-32.png': 'fbb72a5a7a55eb1116d7ef6adb491fc4012836ddb01610cf1d7f169f94b5b60b',
  '/wp-content/mu-plugins/missionmed-site-icon-assets/missionmed-favicon-48.png': 'e3c64ee9f86706f769c39675adc88a756231b2bd7cfeec8ccc39c09771e5a076',
  '/wp-content/mu-plugins/missionmed-site-icon-assets/missionmed-favicon-180.png': '49809dc9afc56e57e7699481484db56f74b99ab01ca549dfd684d43f5c376af9',
  '/wp-content/mu-plugins/missionmed-site-icon-assets/missionmed-favicon-192.png': '892448047cdb289005529368ee40fac10b451d4a19c69913140edf6cef31a860',
  '/wp-content/mu-plugins/missionmed-site-icon-assets/missionmed-favicon-512.png': '1ab7df4a816225f0a6dd445f702d18b1d956989268f8dbe7a00ec880bc14aa83',
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
    userAgent: 'MissionMed-Favicon-Fresh-Context-QA/1.0',
  });
  const report = {
    generated_at_utc: new Date().toISOString(),
    fresh_browser_context: true,
    device_scale_factor: 2,
    routes: [],
    assets: [],
  };

  for (const [name, route, expectedText] of routes) {
    const page = await context.newPage();
    const failed = [];
    page.on('requestfailed', request => {
      const pathname = new URL(request.url()).pathname;
      if (/favicon|site-icon|apple-touch/i.test(pathname)) {
        failed.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
      }
    });
    const url = `${origin}${route}${route.includes('?') ? '&' : '?'}favicon_qa=${Date.now()}`;
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const icons = await page.locator('link[rel~="icon"], link[rel="apple-touch-icon"]').evaluateAll(nodes =>
      nodes.map(node => ({
        rel: node.getAttribute('rel'),
        href: node.href,
        sizes: node.getAttribute('sizes'),
        type: node.getAttribute('type'),
      }))
    );
    const title = await page.title();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const expectedTextPresent = `${title}\n${bodyText}`.includes(expectedText);
    const iconChecks = [];
    for (const icon of icons) {
      const iconResponse = await context.request.get(icon.href, { failOnStatusCode: false });
      iconChecks.push({ href: icon.href, status: iconResponse.status(), content_type: iconResponse.headers()['content-type'] || '' });
    }
    const faviconFamily = icons.some(icon => /missionmed-favicon-(?:512-)?(?:32x32|192x192|16|32|48|180|192|512)|missionmed-site-icon-assets/i.test(icon.href));
    report.routes.push({
      name,
      requested_url: url,
      final_url: page.url(),
      status: response?.status() || 0,
      title,
      expected_text_present: expectedTextPresent,
      favicon_family_present: faviconFamily,
      icons,
      icon_checks: iconChecks,
      failed_icon_requests: failed,
      pass: response?.status() === 200
        && expectedTextPresent
        && faviconFamily
        && icons.length >= 3
        && iconChecks.every(check => check.status === 200)
        && failed.length === 0,
    });
    await page.close();
  }

  for (const [assetPath, expectedSha256] of Object.entries(expectedAssets)) {
    const url = `${origin}${assetPath}?favicon_asset_qa=1`;
    const response = await context.request.get(url, { failOnStatusCode: false });
    const body = Buffer.from(await response.body());
    const sha256 = crypto.createHash('sha256').update(body).digest('hex');
    report.assets.push({
      path: assetPath,
      status: response.status(),
      content_type: response.headers()['content-type'] || '',
      bytes: body.length,
      sha256,
      expected_sha256: expectedSha256,
      pass: response.status() === 200 && sha256 === expectedSha256,
    });
  }

  report.pass = report.routes.every(route => route.pass) && report.assets.every(asset => asset.pass);
  const output = path.resolve(__dirname, 'FAVICON_LIVE_QA.json');
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ pass: report.pass, output, routes: report.routes.map(r => [r.name, r.pass]), assets: report.assets.map(a => [a.path, a.pass]) }, null, 2));
  await browser.close();
  process.exit(report.pass ? 0 : 1);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
