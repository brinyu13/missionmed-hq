const [port] = process.argv.slice(2);
if (!port) throw new Error('Usage: node rendered-public-sweep-cdp.mjs PORT');

const origin = 'https://missionmedinstitute.com';
const completeQuery = 'add-to-cart=3576&variation_id=5865&attribute_pa_start-date=session-d-start-date';
const routes = [
  { path: '/', expect: ['Fall 2026', 'IV Prep Complete', '$2,799', 'IV Prep Essentials', '$1,199', '360 enrollment is closed'] },
  { path: '/mission-residency/', expect: ['Fall 2026 enrollment is open', 'IV Prep Complete', '$2,799', 'IV Prep Essentials', '$1,199', 'ENROLLMENT CLOSED'] },
  { path: '/mission-residency-courses/', expect: ['IV Prep Complete', '$2,799', 'IV Prep Essentials', '$1,199', 'ENROLLMENT CLOSED'] },
  { path: '/compare-programs/', expect: ['IV Prep Complete', '$2,799', 'IV Prep Essentials', '$1,199', 'ENROLLMENT CLOSED'] },
  { path: '/course-comparison/', expect: ['IV Prep Complete', '$2,799', 'IV Prep Essentials', '$1,199', 'ENROLLMENT CLOSED'] },
  { path: '/product/match-prep-pro/', expect: ['IV Prep Complete', '$2,799', 'Enroll in IV Prep Complete'] },
  { path: '/product/iv-prep-complete/', expect: ['IV Prep Complete', '$2,799', 'Enroll in IV Prep Complete'] },
  { path: '/product/iv-prep-masterclass/', expect: ['IV Prep Essentials', '$1,199', 'Enroll in IV Prep Essentials'] },
  { path: '/product/iv-prep-essentials/', expect: ['IV Prep Essentials', '$1,199', 'Enroll in IV Prep Essentials'] },
  { path: '/product/360-match-mentorship/', expect: ['360 Match Mentorship', '$5,499', 'Enrollment for 2026-27 is closed'] },
  { path: `/cart/?${completeQuery}`, expect: ['IV Prep Complete', '$2,799'] },
  { path: '/checkout/', expect: ['Checkout', 'IV Prep Complete', '$2,799', 'Credit / Debit Card'] },
];

const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
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
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });

const results = [];
for (let index = 0; index < routes.length; index += 1) {
  const route = routes[index];
  const separator = route.path.includes('?') ? '&' : '?';
  await send('Page.navigate', { url: `${origin}${route.path}${separator}mr0904c_rendered=${index}` });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const ready = await send('Runtime.evaluate', {
      expression: "document.readyState === 'complete' && (document.body?.innerText || '').trim().length > 40",
      returnByValue: true,
    });
    if (ready.result?.value === true) break;
  }
  await new Promise((resolve) => setTimeout(resolve, 650));
  const payload = await send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body?.innerText || '';
      const stalePatterns = [
        'Match Prep Pro', 'IV Prep Masterclass', 'Interview Prep Foundation', 'July 1',
        '$3,999', '$3,749', '$1,849', '$1,699', 'MatchFirst',
        'Forever Match Guarantee', 'Unlimited mock', '6-Month', '$1,200', '$466.50',
        'August 1', 'Session C', 'Price increases', 'Early Enrollment'
      ];
      const legacy1499Misuse = /IV Prep Essentials[\\s\\S]{0,300}\\$1,499|\\$1,499[\\s\\S]{0,300}IV Prep Essentials/i.test(text);
      const paymentLabels = [...document.querySelectorAll('.wc_payment_methods > .wc_payment_method > label')]
        .filter((el) => getComputedStyle(el).display !== 'none')
        .map((el) => (el.textContent || '').trim()).filter(Boolean);
      return {
        url: location.href,
        statusTitle: document.title,
        heading: document.querySelector('h1')?.textContent?.trim() || null,
        staleHits: stalePatterns.filter((item) => text.toLowerCase().includes(item.toLowerCase())).concat(legacy1499Misuse ? ['$1,499 as Essentials'] : []),
        expected: ${JSON.stringify(route.expect)}.map((item) => ({ item, present: text.toLowerCase().includes(item.toLowerCase()) })),
        checkoutLinks: [...document.querySelectorAll('a[href]')].filter((a) => /checkout|add-to-cart/i.test(a.href)).map((a) => a.href),
        paymentLabels,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    })()`,
    returnByValue: true,
  });
  const value = payload.result.value;
  value.path = route.path;
  value.pass = value.staleHits.length === 0
    && value.expected.every((item) => item.present)
    && value.overflow === false
    && (route.path !== '/product/360-match-mentorship/' || value.checkoutLinks.length === 0)
    && (route.path !== '/checkout/' || (value.paymentLabels.length === 1 && /Credit \/ Debit Card/i.test(value.paymentLabels[0])));
  results.push(value);
}

const report = {
  schema: 'missionmed.mr_web_0904c.rendered_public_sweep.v1',
  verified_at_utc: new Date().toISOString(),
  logged_out_isolated_profile: true,
  results,
  pass_count: results.filter((item) => item.pass).length,
  check_count: results.length,
};
console.log(JSON.stringify(report, null, 2));
socket.close();
if (report.pass_count !== report.check_count) process.exitCode = 1;
