const fs = require('fs');
const path = require('path');
const { chromium } = require('/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const origin = 'https://missionmedinstitute.com';
const accessCode = process.env.MR_PRIVATE_ACCESS_CODE || '';
const evidenceDir = __dirname;
const screenshotDir = path.join(evidenceDir, 'screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

if (!accessCode) throw new Error('MR_PRIVATE_ACCESS_CODE is required');

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'tablet-1024', width: 1024, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
];

const forbidden = /internal QA|enrollment opens after verification|142 alumni|MatchFirst|Match Prep Pro|out of stock|use desktop/i;
const normalized = async page => (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
const geometry = page => page.evaluate(() => ({
  innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  overflowing: document.documentElement.scrollWidth > innerWidth + 1,
}));
const cartButtonEvidence = async page => {
  const button = page.locator('#mm-mr-0912-cart-button');
  const present = await button.count() === 1;
  const box = present ? await button.boundingBox() : null;
  return {
    present,
    visible: present && await button.isVisible(),
    href: present ? await button.getAttribute('href') : null,
    label: present ? await button.getAttribute('aria-label') : null,
    count: present ? (await button.locator('.mm-mr-0912-cart-count').innerText()).trim() : null,
    position: present ? await button.evaluate(node => getComputedStyle(node).position) : null,
    minimumTapTarget: !!box && box.width >= 44 && box.height >= 44,
    insideViewport: !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= page.viewportSize().width && box.y + box.height <= page.viewportSize().height,
  };
};

async function goto(page, url) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  return response;
}

async function grantAccess(page, offer) {
  await goto(page, `${origin}/mission-residency/?qa=foreman-final-${offer}&utm_source=foreman&utm_medium=qa&utm_campaign=final`);
  await page.waitForSelector('[data-action="complete"]:visible', { timeout: 30000 });
  if (offer === 'interview_week') {
    await page.locator('[data-action="iw"]:visible').first().click();
    await page.locator('#modal[open] [data-action="decline"]').click();
  } else {
    await page.locator('[data-action="complete"]:visible').first().click();
  }
  await page.waitForSelector('#modal[open] .private-access-form', { timeout: 30000 });
  await page.locator('#mr-private-access-code').fill(accessCode);
  await Promise.all([
    page.waitForURL(offer === 'interview_week' ? '**/product/iv-prep-masterclass/**' : '**/product/match-prep-pro/**', { timeout: 30000 }),
    page.locator('.private-access-form button[type="submit"]').click(),
  ]);
  await page.waitForTimeout(1500);
}

async function checkoutEvidence(page) {
  await page.waitForURL('**/checkout/**', { timeout: 30000 });
  await page.waitForSelector('#order_review', { timeout: 30000 });
  await page.waitForTimeout(1600);
  const body = await normalized(page);
  return {
    url: page.url(),
    products: await page.locator('.woocommerce-checkout-review-order-table .product-name').allInnerTexts(),
    totals: await page.locator('.order-total').allInnerTexts(),
    gateways: await page.locator('input[name="payment_method"]').evaluateAll(nodes => nodes.map(node => ({ value: node.value, checked: node.checked }))),
    stripeRendered: await page.locator('input[name="payment_method"][value="stripe"]').count() === 1,
    zelleRendered: await page.locator('input[name="payment_method"][value="bacs"]').count() === 1,
    termsLink: await page.locator('a[href*="terms-of-agreement"]').count() > 0,
    refundLink: await page.locator('a[href*="refund-cancellation-policy"]').count() > 0,
    forbiddenVisible: forbidden.test(body),
    geometry: await geometry(page),
    cartButton: await cartButtonEvidence(page),
  };
}

async function captureRail(browser, rail) {
  const context = await browser.newContext({ viewport: { width: rail.width || 390, height: rail.height || 844 } });
  const page = await context.newPage();
  await page.route('**/*', async route => {
    const request = route.request();
    if (request.method() === 'POST' && /wc-ajax=checkout|payment_intents.*confirm|\/v1\/charges/.test(request.url())) return route.abort();
    return route.continue();
  });
  await grantAccess(page, rail.offer);
  const label = rail.label;
  const action = page.getByRole('link', { name: label, exact: true }).first();
  await Promise.all([
    page.waitForURL('**/checkout/**', { timeout: 30000 }),
    action.click(),
  ]);
  const evidence = await checkoutEvidence(page);
  if (rail.gateway === 'bacs') {
    const bacs = page.locator('input[name="payment_method"][value="bacs"]');
    await bacs.click({ force: true });
    await page.waitForTimeout(1800);
    const zelleBody = await normalized(page);
    evidence.afterZelle = {
      totals: await page.locator('.order-total').allInnerTexts(),
      selected: await bacs.isChecked(),
      onHoldNoAccess: /on hold/i.test(zelleBody) && /access is not granted|no course access is granted|do not receive course access/i.test(zelleBody),
      samePriceNoDiscount: rail.offer !== 'complete' || (/no separate discount/i.test(zelleBody) && /\$3,099/.test(zelleBody)),
      interviewWeekSavings: rail.offer !== 'interview_week' || (/save \$50|\$50 savings/i.test(zelleBody) && /\$499/.test(zelleBody)),
      events: await page.evaluate(() => (window.dataLayer || []).filter(item => item && item.event === 'mr_payment_method_selected')),
    };
  }
  const filename = `${rail.name}.png`;
  await page.screenshot({ path: path.join(screenshotDir, filename), fullPage: true });
  evidence.screenshot = `screenshots/${filename}`;
  await context.close();
  return evidence;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const result = {
    generatedAt: new Date().toISOString(),
    origin,
    livePaymentSubmitted: false,
    viewports: [],
    rails: {},
    directGuards: [],
  };

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const landingResponse = await goto(page, `${origin}/mission-residency/?utm_source=foreman&utm_medium=qa&utm_campaign=final`);
    await page.waitForSelector('[data-action="complete"]:visible', { timeout: 30000 });
    const landingBody = await normalized(page);
    const landing = {
      status: landingResponse && landingResponse.status(),
      publicBrowsingWithoutPrompt: await page.locator('#modal[open]').count() === 0,
      privateCodePublished: /DRJ2026/i.test(landingBody),
      correctPrices: landingBody.includes('$549') && landingBody.includes('$499') && landingBody.includes('$3,099') && landingBody.includes('$3,499'),
      completeIncludesIW: /Complete includes Interview Week/i.test(landingBody) && /never (buy|a separate charge)|no separate Interview Week charge/i.test(landingBody),
      scheduleRange: landingBody.includes('Oct 1') && landingBody.includes('Oct 11'),
      forbiddenVisible: forbidden.test(landingBody),
      geometry: await geometry(page),
      analyticsBootstrap: (await page.locator('script[src*="googletagmanager"]').count()) > 0 || landingBody.includes('Google Tag Manager'),
      dataLayerEvents: await page.evaluate(() => [...new Set((window.dataLayer || []).map(item => item && item.event).filter(Boolean))]),
      cartButton: await cartButtonEvidence(page),
    };
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-landing.png`), fullPage: true });

    await grantAccess(page, 'complete');
    const completeBody = await normalized(page);
    const complete = {
      path: new URL(page.url()).pathname,
      richContent: ['Pre-IV Checkups', 'Post-IV Debriefs', 'Signature Mock', 'Rx Replays', 'Questions applicants ask before choosing'].every(value => completeBody.includes(value)),
      priceAndPlan: completeBody.includes('$3,099') && completeBody.includes('$3,499') && completeBody.includes('$1,000') && completeBody.includes('$400') && completeBody.includes('$3,400'),
      includesIW: /includes Interview Week/i.test(completeBody) && /no separate|never add another/i.test(completeBody),
      correctDates: ['Oct 1', 'Oct 4', 'Oct 6', 'Oct 8', 'Oct 10', 'Oct 11'].every(value => completeBody.includes(value)),
      paymentChoices: ['Continue with card', 'Continue with installments', 'Continue with Zelle'].every(value => completeBody.includes(value)),
      forbiddenVisible: forbidden.test(completeBody),
      geometry: await geometry(page),
      utmPreserved: /utm_source=foreman/.test(page.url()),
      cartButton: await cartButtonEvidence(page),
    };
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-complete.png`), fullPage: true });

    await goto(page, `${origin}/product/iv-prep-masterclass/?utm_source=foreman&utm_medium=qa&utm_campaign=final`);
    const iwBody = await normalized(page);
    const interviewWeek = {
      url: page.url(),
      richContent: ['Questions applicants ask before choosing', 'Orientation'].every(value => iwBody.includes(value)),
      prices: iwBody.includes('$549') && iwBody.includes('$499'),
      correctDates: ['Oct 1', 'Oct 4', 'Oct 6', 'Oct 8', 'Oct 10', 'Oct 11'].every(value => iwBody.includes(value)),
      paymentChoices: ['Continue with card', 'Continue with Zelle'].every(value => iwBody.includes(value)),
      forbiddenVisible: forbidden.test(iwBody),
      geometry: await geometry(page),
      utmPreserved: /utm_source=foreman/.test(page.url()),
      cartButton: await cartButtonEvidence(page),
    };
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-interview-week.png`), fullPage: true });
    result.viewports.push({ viewport, landing, complete, interviewWeek, errors });
    await context.close();
  }

  const rails = [
    { name: 'complete-card-390', offer: 'complete', label: 'Continue with card', gateway: 'stripe' },
    { name: 'complete-installments-390', offer: 'complete', label: 'Continue with installments', gateway: 'stripe' },
    { name: 'complete-zelle-390', offer: 'complete', label: 'Continue with Zelle', gateway: 'bacs' },
    { name: 'interview-week-card-390', offer: 'interview_week', label: 'Continue with card', gateway: 'stripe' },
    { name: 'interview-week-zelle-390', offer: 'interview_week', label: 'Continue with Zelle', gateway: 'bacs' },
  ];
  for (const rail of rails) result.rails[rail.name] = await captureRail(browser, rail);

  for (const [offer, target] of [
    ['interview_week', '/checkout/?add-to-cart=5504&variation_id=5867&attribute_pa_start-date=session-d-start-date'],
    ['complete', '/checkout/?add-to-cart=3576&variation_id=5865&attribute_pa_start-date=session-d-start-date'],
    ['complete_installment', '/checkout/?add-to-cart=5513&variation_id=5873&attribute_pa_start-date=session-d-start-date'],
  ]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const response = await goto(page, origin + target);
    const body = await normalized(page);
    result.directGuards.push({
      offer,
      status: response && response.status(),
      path: new URL(page.url()).pathname,
      promptVisible: await page.locator('#modal[open] .private-access-form').count() === 1,
      signedResumeToken: new URL(page.url()).searchParams.has('mr_private_access_token'),
      intendedOfferVisible: body.toLowerCase().includes(offer === 'interview_week' ? 'interview week' : 'private enrollment'),
    });
    await context.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(evidenceDir, 'FINAL_PRODUCTION_QA.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
