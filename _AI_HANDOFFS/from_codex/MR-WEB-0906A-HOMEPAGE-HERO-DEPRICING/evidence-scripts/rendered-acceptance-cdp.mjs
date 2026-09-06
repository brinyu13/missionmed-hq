const [port] = process.argv.slice(2);
if (!port) throw new Error('Usage: node rendered-acceptance-cdp.mjs PORT');

const origin = 'https://missionmedinstitute.com';
const completeQuery = 'add-to-cart=3576&variation_id=5865&attribute_pa_start-date=session-d-start-date';
const homepagePrices = ['$2,799', '$1,199', '$5,499', '$3,999', '$1,849', '$1,499', '$3,299', '$3,199'];
const routes = [
  {
    name: 'corporate_home',
    path: '/',
    expect: [
      'It is interview season.',
      'One expert. Your whole interview season.',
      'Fall 2026 Mission Residency',
      'Enrollment is now open.',
      'IV Prep Essentials and IV Prep Complete are accepting students.',
      '360 Match Mentorship capacity is reached for the current cycle.',
      'Explore Mission Residency',
      'View Programs',
    ],
    absent: [...homepagePrices, 'launch tuition'],
  },
  {
    name: 'mission_residency',
    path: '/mission-residency/',
    expect: ['IV Prep Complete', '$2,799', 'IV Prep Essentials', '$1,199', '360 Match Mentorship', '$5,499'],
    absent: [],
  },
  {
    name: 'complete_product',
    path: '/product/match-prep-pro/',
    expect: ['IV Prep Complete', '$2,799', 'Enroll in IV Prep Complete'],
    absent: [],
  },
  {
    name: 'complete_cart',
    path: `/cart/?${completeQuery}`,
    expect: ['IV Prep Complete', '$2,799'],
    absent: [],
  },
  {
    name: 'complete_checkout',
    path: '/checkout/',
    expect: ['Checkout', 'IV Prep Complete', '$2,799', 'Credit / Debit Card'],
    absent: [],
  },
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
  const callbacks = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) callbacks.reject(new Error(message.error.message));
  else callbacks.resolve(message.result);
});

function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await send('Page.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1200,
  deviceScaleFactor: 1,
  mobile: false,
});

const results = [];
for (let index = 0; index < routes.length; index += 1) {
  const route = routes[index];
  const separator = route.path.includes('?') ? '&' : '?';
  await send('Page.navigate', { url: `${origin}${route.path}${separator}mr0906a=${Date.now()}-${index}` });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const state = await send('Runtime.evaluate', {
      expression: "document.readyState === 'complete' && (document.body?.innerText || '').trim().length > 40",
      returnByValue: true,
    });
    if (state.result?.value === true) {
      ready = true;
      break;
    }
  }
  if (!ready) throw new Error(`Route did not become ready: ${route.path}`);
  await new Promise((resolve) => setTimeout(resolve, 900));

  const payload = await send('Runtime.evaluate', {
    expression: `JSON.stringify((() => {
      const text = document.body?.innerText || '';
      const expected = ${JSON.stringify(route.expect)}.map((item) => ({ item, present: text.toLowerCase().includes(item.toLowerCase()) }));
      const absent = ${JSON.stringify(route.absent)}.map((item) => ({ item, present: text.toLowerCase().includes(item.toLowerCase()) }));
      const paymentLabels = [...document.querySelectorAll('.wc_payment_methods > .wc_payment_method > label')]
        .filter((element) => getComputedStyle(element).display !== 'none')
        .map((element) => (element.textContent || '').replace(/\\s+/g, ' ').trim())
        .filter(Boolean);
      return {
        url: location.href,
        title: document.title,
        heading: document.querySelector('h1')?.textContent?.replace(/\\s+/g, ' ').trim() || null,
        expected,
        absent,
        paymentLabels,
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    })())`,
    returnByValue: true,
  });
  const value = JSON.parse(payload.result.value);
  value.name = route.name;
  value.path = route.path;
  value.pass = value.expected.every((item) => item.present)
    && value.absent.every((item) => !item.present)
    && (route.name !== 'complete_checkout'
      || (value.paymentLabels.length === 1 && /Credit \/ Debit Card/i.test(value.paymentLabels[0])));
  results.push(value);
}

const report = {
  schema: 'missionmed.mr_web_0906a.rendered_acceptance.v1',
  verified_at_utc: new Date().toISOString(),
  logged_out_isolated_profile: true,
  results,
  pass_count: results.filter((item) => item.pass).length,
  check_count: results.length,
};
console.log(JSON.stringify(report, null, 2));
socket.close();
if (report.pass_count !== report.check_count) process.exitCode = 1;
