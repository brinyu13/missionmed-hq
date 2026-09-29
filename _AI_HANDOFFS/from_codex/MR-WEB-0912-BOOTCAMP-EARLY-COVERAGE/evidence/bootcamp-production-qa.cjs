const fs = require('fs');
const path = require('path');
const { chromium } = require('/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const origin = 'https://missionmedinstitute.com';
const evidenceDir = __dirname;
const screenshotDir = path.join(evidenceDir, 'screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'tablet-1024', width: 1024, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
];
const dates = ['Oct 8', 'Oct 11', 'Oct 13', 'Oct 15', 'Oct 17', 'Oct 18'];
const forbidden = /internal QA|enrollment opens after verification|142 alumni|MatchFirst|Match Prep Pro|out of stock|use desktop|DRJ2026|\bInterview Week\b/i;
const normalized = async page => (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
const optionalAttribute = async (page, selector, attribute) => {
  const locator = page.locator(selector);
  return await locator.count() ? locator.first().getAttribute(attribute) : null;
};
const geometry = page => page.evaluate(() => ({
  innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  overflowing: document.documentElement.scrollWidth > innerWidth + 1,
}));
const events = page => page.evaluate(() => (window.dataLayer || []).map(x => {
  if (!x) return null;
  if (x.event) return { event:x.event, offer:x.offer||null, rail:x.rail||x.payment_choice||null, destination_path:x.destination_path||null, utm_source:x.utm_source||null, items:x.items||null };
  if (x[0] === 'event') { const p=x[2]||{}; return { event:x[1], offer:p.offer||null, rail:p.rail||p.payment_choice||null, destination_path:p.destination_path||null, utm_source:p.utm_source||null, items:p.items||null }; }
  return null;
}).filter(Boolean));

async function goto(page, route) {
  const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2200);
  return response;
}

async function cartButton(page) {
  const button = page.locator('#mm-mr-0912-cart-button');
  const present = await button.count() === 1;
  const box = present ? await button.boundingBox() : null;
  return {
    present,
    visible: present && await button.isVisible(),
    href: present ? await button.getAttribute('href') : null,
    minimumTapTarget: !!box && box.width >= 44 && box.height >= 44,
    fixed: present ? await button.evaluate(n => getComputedStyle(n).position === 'fixed') : false,
  };
}

async function routeEvidence(page, route, kind, shot) {
  const response = await goto(page, route);
  const body = await normalized(page);
  const result = {
    route,
    status: response && response.status(),
    path: new URL(page.url()).pathname,
    title: await page.title(),
    metaDescription: await optionalAttribute(page, 'meta[name="description"]', 'content'),
    openGraphTitle: await optionalAttribute(page, 'meta[property="og:title"]', 'content'),
    forbiddenVisible: forbidden.test(body),
    bootcampNameVisible: /Interview Bootcamp Week/.test(body),
    earlyCoverageVisible: /on or before (Oct|October) 18/i.test(body) && /Dr Brian will personally provide individualized emergency (interview )?prep/i.test(body),
    privatePromptVisible: await page.locator('#modal[open] .private-access-form').count() > 0,
    geometry: await geometry(page),
    cartButton: await cartButton(page),
    dataLayer: await events(page),
  };
  if (kind === 'landing') {
    const scheduleDays = await page.locator('.week-day .week-num').allInnerTexts();
    Object.assign(result, {
      scheduleDays,
      datesPresent: JSON.stringify(scheduleDays) === JSON.stringify(['8', '11', '13', '15', '17', '18']),
      oldRangeAbsent: /Oct 8\s*→\s*Oct 18/.test(body) && !/October 1 to October 11/.test(body),
      pricesPresent: ['$549', '$499', '$3,099', '$3,499', '$3,400'].every(v => body.includes(v)),
      includesStatement: /Complete includes Interview Bootcamp Week/i.test(body) && /never (buy|a separate charge)|no separate Interview Bootcamp Week charge/i.test(body),
      publicBrowsing: await page.locator('#modal[open]').count() === 0,
    });
    const bootcampChoice = page.getByRole('button', { name: 'View Interview Bootcamp Week details & payment choices' }).first();
    await bootcampChoice.click();
    await page.locator('#modal[open]').waitFor({ state: 'visible' });
    const interceptText = (await page.locator('#modal[open]').innerText()).replace(/\s+/g, ' ').trim();
    result.intercept = {
      bootcampNameVisible: /INTERVIEW BOOTCAMP WEEK/.test(interceptText),
      staleInterviewWeekAbsent: !/\bINTERVIEW WEEK\b/.test(interceptText),
      completeInclusionVisible: /Complete includes Interview Bootcamp Week/i.test(interceptText),
    };
    await page.screenshot({ path: path.join(screenshotDir, `${shot.replace(/\.png$/, '')}-intercept.png`), fullPage: true });
    await page.getByRole('button', { name: 'Close dialog' }).click();
  }
  if (kind === 'complete') {
    Object.assign(result, {
      datesPresent: dates.every(d => body.includes(d)),
      pricingPresent: ['$3,099', '$3,499', '$1,000', '$400', '$3,400'].every(v => body.includes(v)),
      deadlinePresent: /October 7/.test(body),
      includesStatement: /includes Interview Bootcamp Week/i.test(body) && /no separate|never add another/i.test(body),
      railsPresent: ['Continue with card', 'Continue with installments', 'Continue with Zelle'].every(v => body.includes(v)),
      viewItem: (await events(page)).some(e => e.event === 'view_item'),
    });
  }
  if (kind === 'iw') {
    Object.assign(result, {
      datesPresent: dates.every(d => body.includes(d)),
      pricingPresent: body.includes('$549') && body.includes('$499'),
      railsPresent: ['Continue with card', 'Continue with Zelle'].every(v => body.includes(v)),
      viewItem: (await events(page)).some(e => e.event === 'view_item'),
    });
  }
  await page.screenshot({ path: path.join(screenshotDir, shot), fullPage: true });
  return result;
}

async function checkoutRail(browser, name, addToCart, expected, gateway) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route('**/*', async route => {
    const req = route.request();
    if (req.method() === 'POST' && /wc-ajax=checkout|payment_intents.*confirm|\/v1\/charges/.test(req.url())) return route.abort();
    return route.continue();
  });
  const analyticsRequests = [];
  page.on('request', request => {
    if (/google-analytics\.com\/g\/collect/.test(request.url())) {
      const u = new URL(request.url());
      analyticsRequests.push({ event: u.searchParams.get('en'), measurementId: u.searchParams.get('tid') });
    }
  });
  const response = await goto(page, `/checkout/?${addToCart}&utm_source=recovery&utm_medium=qa&utm_campaign=zero_enrollment`);
  await page.waitForSelector('#order_review', { timeout: 30000 });
  await page.waitForTimeout(1800);
  if (gateway === 'bacs') {
    const bacs = page.locator('input[name="payment_method"][value="bacs"]');
    await bacs.click({ force: true });
    await page.waitForTimeout(1600);
  }
  const body = await normalized(page);
  const result = {
    status: response && response.status(),
    path: new URL(page.url()).pathname,
    noPrivatePrompt: await page.locator('#modal[open] .private-access-form').count() === 0,
    expectedTotal: body.includes(expected),
    products: await page.locator('.woocommerce-checkout-review-order-table .product-name').allInnerTexts(),
    totals: await page.locator('.order-total').allInnerTexts(),
    gateways: await page.locator('input[name="payment_method"]').evaluateAll(nodes => nodes.map(n => ({ value: n.value, checked: n.checked }))),
    termsLink: await page.locator('a[href*="terms-of-agreement"]').count() > 0,
    refundLink: await page.locator('a[href*="refund-cancellation-policy"]').count() > 0,
    noPaymentSubmitted: true,
    forbiddenVisible: forbidden.test(body),
    geometry: await geometry(page),
    cartButton: await cartButton(page),
    dataLayer: await events(page),
    analyticsRequests,
  };
  await page.screenshot({ path: path.join(screenshotDir, `${name}.png`), fullPage: true });
  await context.close();
  return result;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const result = { generatedAt: new Date().toISOString(), origin, livePaymentSubmitted: false, viewports: [], rails: {}, guards: {} };

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const suffix = 'utm_source=bootcamp_qa&utm_medium=qa&utm_campaign=early_interview_coverage';
    const landing = await routeEvidence(page, `/mission-residency/?${suffix}`, 'landing', `${viewport.name}-landing.png`);
    const complete = await routeEvidence(page, `/product/match-prep-pro/?${suffix}`, 'complete', `${viewport.name}-complete.png`);
    const interviewBootcampWeek = await routeEvidence(page, `/product/iv-prep-masterclass/?${suffix}`, 'iw', `${viewport.name}-interview-bootcamp-week.png`);
    const compare = await routeEvidence(page, `/mission-residency-courses/?${suffix}`, 'compare', `${viewport.name}-compare.png`);
    const home = await routeEvidence(page, `/?${suffix}`, 'home', `${viewport.name}-home.png`);
    result.viewports.push({ viewport, landing, complete, interviewBootcampWeek, compare, home, errors });
    await context.close();
  }

  result.rails.interviewBootcampWeekCard = await checkoutRail(browser, 'bootcamp-card', 'add-to-cart=5504&variation_id=5867&attribute_pa_start-date=session-d-start-date', '$549', 'stripe');
  result.rails.interviewBootcampWeekZelle = await checkoutRail(browser, 'bootcamp-zelle', 'add-to-cart=5504&variation_id=5867&attribute_pa_start-date=session-d-start-date&mr_payment=zelle', '$499', 'bacs');
  result.rails.completeCard = await checkoutRail(browser, 'complete-card', 'add-to-cart=3576&variation_id=5865&attribute_pa_start-date=session-d-start-date', '$3,099', 'stripe');
  result.rails.completeZelle = await checkoutRail(browser, 'complete-zelle', 'add-to-cart=3576&variation_id=5865&attribute_pa_start-date=session-d-start-date&mr_payment=zelle', '$3,099', 'bacs');
  result.rails.installments = await checkoutRail(browser, 'complete-installments', 'add-to-cart=5513&variation_id=5873&attribute_pa_start-date=session-d-start-date', '$1,000', 'stripe');

  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await goto(page, '/cart/?add-to-cart=5504&variation_id=5867&attribute_pa_start-date=session-d-start-date');
    await goto(page, '/cart/?add-to-cart=3576&variation_id=5865&attribute_pa_start-date=session-d-start-date');
    const body = await normalized(page);
    result.guards.mixedCart = {
      productRows: await page.locator('.woocommerce-cart-form__cart-item').count(),
      blockedMessage: /Choose either Interview Bootcamp Week or IV Prep Complete/i.test(body),
      noPaymentSubmitted: true,
    };
    await context.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(evidenceDir, 'BOOTCAMP_PRODUCTION_QA.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error.stack || error); process.exit(1); });
