const [port, phase = 'closed'] = process.argv.slice(2);
if (!port || !['closed', 'open'].includes(phase)) {
  throw new Error('Usage: node mr-web-0912-rendered-sweep-cdp.mjs PORT [closed|open]');
}

const origin = 'https://missionmedinstitute.com';
const routes = [
  { path: '/', kind: 'home' },
  { path: '/mission-residency/', kind: 'landing' },
  { path: '/mission-residency-courses/', kind: 'landing' },
  { path: '/compare-programs/', kind: 'landing' },
  { path: '/course-comparison/', kind: 'landing' },
  { path: '/product/match-prep-pro/', kind: 'complete' },
  { path: '/product/iv-prep-complete/', kind: 'complete' },
  { path: '/product/iv-prep-masterclass/', kind: 'interview' },
  { path: '/product/iv-prep-essentials/', kind: 'interview' },
  { path: '/mission-residency-waitlist/', kind: 'waitlist' },
  { path: '/terms-of-agreement/', kind: 'policy' },
  { path: '/refund-cancellation-policy/', kind: 'policy' },
  { path: '/privacy-policy/', kind: 'policy' },
  { path: '/cart/', kind: 'system' },
  { path: '/checkout/', kind: 'system' },
];
const viewports = [
  { name: 'desktop', width: 1440, height: 1200, mobile: false },
  { name: 'tablet', width: 1024, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];

const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
const target = targets.find((item) => item.type === 'page');
if (!target?.webSocketDebuggerUrl) throw new Error('No Chrome page target found.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
let observedRequests = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.method === 'Network.requestWillBeSent' && message.params?.request?.url) {
    observedRequests.push(message.params.request.url);
  }
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});
function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluateByValue(expression, attempts = 12) {
  let lastDiagnostic = 'no Runtime.evaluate response';
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await send('Runtime.evaluate', { expression, returnByValue: true });
      if (response.result && Object.hasOwn(response.result, 'value')) return response.result.value;
      lastDiagnostic = response.exceptionDetails?.text
        || response.result?.description
        || JSON.stringify(response);
    } catch (error) {
      lastDiagnostic = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Runtime.evaluate did not return a value: ${lastDiagnostic}`);
}

await send('Page.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });

const results = [];
for (const viewport of viewports) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
  });

  for (let index = 0; index < routes.length; index += 1) {
    const route = routes[index];
    await send('Network.clearBrowserCookies');
    observedRequests = [];
    const separator = route.path.includes('?') ? '&' : '?';
    await send('Page.navigate', {
      url: `${origin}${route.path}${separator}mr0912_rendered=${phase}-${viewport.name}-${index}`,
    });
    const candidateRoute = ['landing', 'complete', 'interview'].includes(route.kind);
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const ready = await send('Runtime.evaluate', {
        expression: candidateRoute
          ? "document.readyState === 'complete' && !!document.querySelector('h1') && (document.body?.innerText || '').trim().length > 1000"
          : "document.readyState === 'complete' && (document.body?.innerText || '').trim().length > 20",
        returnByValue: true,
      });
      if (ready.result?.value === true) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));

    const payload = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body?.innerText || '';
        const lower = text.toLowerCase();
        const campaignStalePatterns = [
          '142 alumni', 'alumni matched and counting', 'matched hundreds',
          'Match Prep Pro', 'IV Prep Masterclass', 'Interview Prep Foundation',
          'Unlimited mock', 'Four Signature Mock', '$1,199', 'Sept 12', 'September 12'
        ];
        const globalBannedPatterns = ['142 alumni', 'alumni matched and counting'];
        const stalePatterns = ${JSON.stringify(route.kind)} === 'reference'
          ? globalBannedPatterns
          : campaignStalePatterns;
        const checkoutLinks = [...document.querySelectorAll('a[href]')]
          .filter((anchor) => /checkout|add-to-cart/i.test(anchor.href))
          .map((anchor) => anchor.href);
        return {
          url: location.href,
          title: document.title,
          heading: document.querySelector('h1')?.textContent?.trim() || null,
          textLength: text.length,
          staleHits: stalePatterns.filter((item) => lower.includes(item.toLowerCase())),
          hasInterviewTitle: lower.includes('iv prep essentials: interview week'),
          hasInterviewPrice: lower.includes('$500'),
          hasCompleteTitle: lower.includes('iv prep complete'),
          hasCompleteStandard: lower.includes('$3,499'),
          hasCompleteEarlyCard: lower.includes('$3,099'),
          hasClosedLabel: lower.includes('enrollment opens after verification'),
          hasBannedEarlyPif: lower.includes('$2,799'),
          hasUnsupportedInstallments: lower.includes('$3,299'),
          hasInternalQa: ['enrollment opens after verification', 'current operational limits', 'commerce safety', 'qa test mode']
            .some((item) => lower.includes(item)),
          hasOutOfStock: lower.includes('out of stock'),
          hasMobileDesktopWarning: !!document.querySelector('#mm-mobile-notice')
            || lower.includes('get the full missionmed experience on desktop'),
          hasInterviewIncluded: lower.includes('interview week included')
            || lower.includes('complete includes interview week')
            || lower.includes('iv prep complete includes interview week'),
          checkoutLinks,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          dimensions: {
            innerWidth: window.innerWidth,
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
          },
        };
      })()`,
      returnByValue: true,
    });

    const value = payload.result.value;
    const identityPass = route.kind === 'landing'
      ? value.hasInterviewTitle && value.hasInterviewPrice && value.hasCompleteTitle && value.hasCompleteStandard
      : route.kind === 'complete'
        ? value.hasCompleteTitle && value.hasCompleteStandard
        : route.kind === 'interview'
          ? value.hasInterviewTitle && value.hasInterviewPrice
          : true;
    const phasePass = phase === 'closed' && ['landing', 'complete', 'interview'].includes(route.kind)
      ? (value.hasClosedLabel || value.checkoutLinks.length === 0)
      : phase === 'open' && ['landing', 'complete'].includes(route.kind)
        ? value.hasCompleteEarlyCard
        : true;
    const priceTruthPass = ['landing', 'complete', 'interview'].includes(route.kind)
      ? !value.hasBannedEarlyPif && !value.hasUnsupportedInstallments
      : true;
    value.path = route.path;
    value.kind = route.kind;
    value.viewport = viewport.name;
    value.analyticsRequests = observedRequests.filter((url) => /googletagmanager|google-analytics|\/g\/collect|\/collect\?/i.test(url));
    const waitlistPass = route.kind !== 'waitlist'
      || new URL(value.url).pathname === '/mission-residency/';
    const policyPass = route.kind !== 'policy'
      || value.heading !== null;
    const customerRoute = !['system'].includes(route.kind);
    const analyticsPass = !['/', '/mission-residency/'].includes(route.path)
      || value.analyticsRequests.length > 0;
    value.pass = value.textLength > 20
      && value.staleHits.length === 0
      && value.overflow === false
      && (!customerRoute || (!value.hasInternalQa && !value.hasOutOfStock && !value.hasMobileDesktopWarning))
      && identityPass
      && phasePass
      && priceTruthPass
      && waitlistPass
      && policyPass
      && analyticsPass;
    results.push(value);
  }
}

const checkoutCases = [];
if (phase === 'open') {
  const cases = [
    { key: 'interview_week', product: 5504, variation: 5867, amount: '$500', title: 'interview week' },
    { key: 'complete', product: 3576, variation: 5865, amount: '$3,099', title: 'iv prep complete' },
  ];
  for (const viewport of viewports) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile,
    });
    for (const candidate of cases) {
      await send('Network.clearBrowserCookies');
      observedRequests = [];
      const url = `${origin}/checkout/?add-to-cart=${candidate.product}&variation_id=${candidate.variation}&attribute_pa_start-date=session-d-start-date&mr0912_checkout=${candidate.key}-${viewport.name}`;
      await send('Page.navigate', { url });
      for (let attempt = 0; attempt < 100; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const ready = await send('Runtime.evaluate', {
          expression: "document.readyState === 'complete' && !!document.querySelector('#place_order,form.checkout')",
          returnByValue: true,
        });
        if (ready.result?.value === true) break;
      }
      await new Promise((resolve) => setTimeout(resolve, 600));
      const value = await evaluateByValue(`(() => {
          const text = document.body?.innerText || '';
          const lower = text.toLowerCase();
          const hrefs = [...document.querySelectorAll('a[href]')].map((a) => a.href);
          const paymentIds = [...document.querySelectorAll('input[name="payment_method"]')].map((n) => n.value);
          return {
            url: location.href,
            textLength: text.length,
            bodyText: text.slice(0, 12000),
            hasTitle: lower.includes(${JSON.stringify(candidate.title)}),
            hasAmount: text.includes(${JSON.stringify(candidate.amount)}),
            hasPlaceOrder: !!document.querySelector('#place_order'),
            paymentIds,
            stripeCardRendered: paymentIds.includes('stripe')
              && !!document.querySelector('.payment_method_stripe, #wc-stripe-card-element, iframe[src*="stripe"]'),
            accountCreation: !!document.querySelector('#createaccount, .create-account, #account_password')
              || /create (an )?account|account username|account password/i.test(text),
            policyLinks: {
              terms: hrefs.some((href) => href.includes('/terms-of-agreement/')),
              refund: hrefs.some((href) => href.includes('/refund-cancellation-policy/')),
              privacy: hrefs.some((href) => href.includes('/privacy-policy/')),
            },
            hasOutOfStock: lower.includes('out of stock'),
            hasInternalQa: ['enrollment opens after verification', 'operational limits', 'commerce safety']
              .some((item) => lower.includes(item)),
            hasMobileDesktopWarning: !!document.querySelector('#mm-mobile-notice')
              || lower.includes('get the full missionmed experience on desktop'),
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          };
        })()`);
      value.key = candidate.key;
      value.viewport = viewport.name;
      value.analyticsRequests = observedRequests.filter((requestUrl) => /googletagmanager|google-analytics|\/g\/collect|\/collect\?/i.test(requestUrl));
      value.pass = value.textLength > 100
        && value.hasTitle
        && value.hasAmount
        && value.hasPlaceOrder
        && value.paymentIds.length === 1
        && value.paymentIds[0] === 'stripe'
        && value.stripeCardRendered
        && value.accountCreation
        && Object.values(value.policyLinks).every(Boolean)
        && !value.hasOutOfStock
        && !value.hasInternalQa
        && !value.hasMobileDesktopWarning
        && !value.overflow
        && value.analyticsRequests.length > 0;
      delete value.bodyText;
      checkoutCases.push(value);
    }
  }
}

const report = {
  schema: 'missionmed.mr_web_0912.rendered_public_sweep.v1',
  verified_at_utc: new Date().toISOString(),
  logged_out_isolated_profile: true,
  phase,
  viewports,
  results,
  checkout_cases: checkoutCases,
  pass_count: [...results, ...checkoutCases].filter((item) => item.pass).length,
  check_count: results.length + checkoutCases.length,
};
console.log(JSON.stringify(report, null, 2));
socket.close();
if (report.pass_count !== report.check_count) process.exitCode = 1;
