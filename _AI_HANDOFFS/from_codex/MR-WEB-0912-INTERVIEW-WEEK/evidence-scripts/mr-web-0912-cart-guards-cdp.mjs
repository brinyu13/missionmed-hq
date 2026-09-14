const [port] = process.argv.slice(2);
if (!port) throw new Error('Usage: node mr-web-0912-cart-guards-cdp.mjs PORT');

const origin = 'https://missionmedinstitute.com';
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

async function navigate(path) {
  await send('Page.navigate', { url: `${origin}${path}` });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const ready = await send('Runtime.evaluate', {
      expression: "document.readyState === 'complete' && !!document.body",
      returnByValue: true,
    });
    if (ready.result?.value === true) break;
  }
  await new Promise((resolve) => setTimeout(resolve, 600));
  const response = await send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body?.innerText || '';
      const itemNodes = [...document.querySelectorAll('.cart_item')];
      const itemNames = itemNodes.map((item) =>
        (item.querySelector('.product-name')?.innerText || item.innerText || '').trim()
      );
      const notices = [...document.querySelectorAll(
        '.woocommerce-error, .woocommerce-message, .woocommerce-info, .wc-block-components-notice-banner'
      )].map((node) => (node.innerText || '').trim()).filter(Boolean);
      return {
        url: location.href,
        itemCount: itemNodes.length,
        itemNames,
        notices,
        bodyExcerpt: text.slice(0, 1200),
      };
    })()`,
    returnByValue: true,
  });
  if (!response.result || !Object.hasOwn(response.result, 'value')) {
    throw new Error(response.exceptionDetails?.exception?.description || response.exceptionDetails?.text || 'DOM read failed');
  }
  return response.result.value;
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

const tests = [];
for (const invalid of [
  { key: 'interview_parent_complete_variation', product: 5504, variation: 5865 },
  { key: 'complete_parent_interview_variation', product: 3576, variation: 5867 },
]) {
  await send('Network.clearBrowserCookies');
  const state = await navigate(`/cart/?add-to-cart=${invalid.product}&variation_id=${invalid.variation}&attribute_pa_start-date=session-d-start-date&mr0912_guard=${invalid.key}`);
  state.key = invalid.key;
  state.pass = state.itemCount === 0
    && state.notices.some((notice) => /selection is not valid|choose product options/i.test(notice));
  tests.push(state);
}

for (const missingVariation of [
  { key: 'interview_parent_without_variation', product: 5504 },
  { key: 'complete_parent_without_variation', product: 3576 },
]) {
  await send('Network.clearBrowserCookies');
  const state = await navigate(`/cart/?add-to-cart=${missingVariation.product}&mr0912_guard=${missingVariation.key}`);
  state.key = missingVariation.key;
  state.pass = state.itemCount === 0
    && state.notices.some((notice) => /selection is not valid|choose product options/i.test(notice))
    && !/critical error/i.test(state.bodyExcerpt);
  tests.push(state);
}

for (const duplicateQuantity of [
  { key: 'interview_quantity_two', product: 5504, variation: 5867 },
  { key: 'complete_quantity_two', product: 3576, variation: 5865 },
]) {
  await send('Network.clearBrowserCookies');
  const state = await navigate(`/cart/?add-to-cart=${duplicateQuantity.product}&variation_id=${duplicateQuantity.variation}&attribute_pa_start-date=session-d-start-date&quantity=2&mr0912_guard=${duplicateQuantity.key}`);
  state.key = duplicateQuantity.key;
  state.pass = state.itemCount === 0
    && state.notices.some((notice) => /one seat|only one|cannot add another|only 1/i.test(notice));
  tests.push(state);
}

const valid = {
  interview_week: '/cart/?add-to-cart=5504&variation_id=5867&attribute_pa_start-date=session-d-start-date',
  complete: '/cart/?add-to-cart=3576&variation_id=5865&attribute_pa_start-date=session-d-start-date',
};
for (const pair of [
  { key: 'interview_then_complete', first: 'interview_week', second: 'complete', kept: /interview week/i, rejected: /iv prep complete/i },
  { key: 'complete_then_interview', first: 'complete', second: 'interview_week', kept: /iv prep complete/i, rejected: /interview week/i },
]) {
  await send('Network.clearBrowserCookies');
  const firstState = await navigate(`${valid[pair.first]}&mr0912_guard=${pair.key}-first`);
  const state = await navigate(`${valid[pair.second]}&mr0912_guard=${pair.key}-second`);
  const names = state.itemNames.join('\n');
  state.key = pair.key;
  state.firstItemCount = firstState.itemCount;
  state.pass = firstState.itemCount === 1
    && state.itemCount === 1
    && pair.kept.test(names)
    && !pair.rejected.test(names)
    && state.notices.some((notice) => /choose either interview week or iv prep complete/i.test(notice));
  tests.push(state);
}

const report = {
  schema: 'missionmed.mr_web_0912.cart_guards.v1',
  verified_at_utc: new Date().toISOString(),
  logged_out_isolated_profile: true,
  live_payment_submitted: false,
  tests,
  pass_count: tests.filter((test) => test.pass).length,
  check_count: tests.length,
};
console.log(JSON.stringify(report, null, 2));
socket.close();
if (report.pass_count !== report.check_count) process.exitCode = 1;
