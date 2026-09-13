const [port, phase = 'closed'] = process.argv.slice(2);
if (!port || !['closed', 'open'].includes(phase)) {
  throw new Error('Usage: node mr-web-0912-rendered-sweep-cdp.mjs PORT [closed|open]');
}

const origin = 'https://missionmedinstitute.com';
const routes = [
  { path: '/', kind: 'landing' },
  { path: '/mission-residency/', kind: 'landing' },
  { path: '/mission-residency-courses/', kind: 'landing' },
  { path: '/compare-programs/', kind: 'landing' },
  { path: '/course-comparison/', kind: 'landing' },
  { path: '/product/match-prep-pro/', kind: 'complete' },
  { path: '/product/iv-prep-complete/', kind: 'complete' },
  { path: '/product/iv-prep-masterclass/', kind: 'interview' },
  { path: '/product/iv-prep-essentials/', kind: 'interview' },
  { path: '/product/360-match-mentorship/', kind: 'reference' },
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
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
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
    const separator = route.path.includes('?') ? '&' : '?';
    await send('Page.navigate', {
      url: `${origin}${route.path}${separator}mr0912_rendered=${phase}-${viewport.name}-${index}`,
    });
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const ready = await send('Runtime.evaluate', {
        expression: "document.readyState === 'complete' && (document.body?.innerText || '').trim().length > 20",
        returnByValue: true,
      });
      if (ready.result?.value === true) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));

    const payload = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body?.innerText || '';
        const lower = text.toLowerCase();
        const stalePatterns = [
          '142 alumni', 'alumni matched and counting', 'matched hundreds',
          'Match Prep Pro', 'IV Prep Masterclass', 'Interview Prep Foundation',
          'Unlimited mock', 'Four Signature Mock', '$1,199', 'Sept 12', 'September 12'
        ];
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
      ? value.hasInterviewTitle && value.hasInterviewPrice && value.hasCompleteTitle && value.hasCompleteStandard && value.hasCompleteEarlyCard
      : route.kind === 'complete'
        ? value.hasCompleteTitle && value.hasCompleteStandard && value.hasCompleteEarlyCard
        : route.kind === 'interview'
          ? value.hasInterviewTitle && value.hasInterviewPrice
          : true;
    const phasePass = phase === 'closed' && ['landing', 'complete', 'interview'].includes(route.kind)
      ? value.hasClosedLabel && value.checkoutLinks.length === 0
      : true;
    const priceTruthPass = ['landing', 'complete', 'interview'].includes(route.kind)
      ? !value.hasBannedEarlyPif && !value.hasUnsupportedInstallments
      : true;
    value.path = route.path;
    value.kind = route.kind;
    value.viewport = viewport.name;
    value.pass = value.textLength > 20
      && value.staleHits.length === 0
      && value.overflow === false
      && identityPass
      && phasePass
      && priceTruthPass;
    results.push(value);
  }
}

const report = {
  schema: 'missionmed.mr_web_0912.rendered_public_sweep.v1',
  verified_at_utc: new Date().toISOString(),
  logged_out_isolated_profile: true,
  phase,
  viewports,
  results,
  pass_count: results.filter((item) => item.pass).length,
  check_count: results.length,
};
console.log(JSON.stringify(report, null, 2));
socket.close();
if (report.pass_count !== report.check_count) process.exitCode = 1;
